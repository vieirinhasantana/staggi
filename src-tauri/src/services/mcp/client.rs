use crate::models::mcp::{McpTestResult, McpTool};

pub fn apply_mcp_auth(
    mut req: reqwest::RequestBuilder,
    api_key: Option<&str>,
    auth_header: Option<&str>,
) -> reqwest::RequestBuilder {
    if let Some(key) = api_key.map(|k| k.trim()).filter(|k| !k.is_empty()) {
        let header_name = auth_header.unwrap_or("Authorization").trim();
        if header_name.eq_ignore_ascii_case("authorization") {
            if key.starts_with("Bearer ") {
                req = req.header("Authorization", key);
            } else {
                req = req.header("Authorization", format!("Bearer {}", key));
            }
        } else {
            req = req.header(header_name, key);
        }
    }
    req
}

pub fn resolve_mcp_endpoint_url(base_target: &str, path_or_url: &str) -> String {
    let trimmed = path_or_url.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else if trimmed.starts_with('/') {
        if let Some(pos) = base_target.find("://") {
            let after_proto = &base_target[pos + 3..];
            let host_end = after_proto.find('/').unwrap_or(after_proto.len());
            let origin = &base_target[..pos + 3 + host_end];
            format!("{}{}", origin, trimmed)
        } else {
            format!("{}{}", base_target.trim_end_matches('/'), trimmed)
        }
    } else {
        format!("{}/{}", base_target.trim_end_matches('/'), trimmed)
    }
}

pub async fn query_mcp_sse_tools(
    client: &reqwest::Client,
    target_url: &str,
    api_key: Option<&str>,
    auth_header: Option<&str>,
) -> Result<Vec<McpTool>, String> {
    let req = client
        .get(target_url)
        .header("Accept", "text/event-stream")
        .header("Cache-Control", "no-cache");
    let req = apply_mcp_auth(req, api_key, auth_header);

    let mut res = req
        .send()
        .await
        .map_err(|e| format!("Failed to connect to SSE endpoint: {}", e))?;

    let status = res.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(format!("AUTH_ERROR: Status {}", status.as_u16()));
    }
    if !status.is_success() {
        return Err(format!(
            "HTTP error {}: {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or("Unknown")
        ));
    }

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<serde_json::Value>();
    let (endpoint_tx, mut endpoint_rx) = tokio::sync::mpsc::channel::<String>(1);

    tokio::spawn(async move {
        let mut buffer = String::new();
        let mut found_endpoint = false;

        while let Ok(Some(chunk)) = res.chunk().await {
            if let Ok(text) = std::str::from_utf8(&chunk) {
                buffer.push_str(text);

                while let Some(pos) = buffer.find("\n\n").or_else(|| buffer.find("\r\n\r\n")) {
                    let sep_len = if buffer[pos..].starts_with("\r\n\r\n") { 4 } else { 2 };
                    let block = buffer[..pos].to_string();
                    buffer = buffer[pos + sep_len..].to_string();

                    let mut event_name = "message".to_string();
                    let mut data_lines = Vec::new();

                    for line in block.lines() {
                        let trimmed = line.trim();
                        if trimmed.starts_with("event:") {
                            event_name = trimmed[6..].trim().to_string();
                        } else if trimmed.starts_with("data:") {
                            data_lines.push(trimmed[5..].trim());
                        }
                    }

                    if !data_lines.is_empty() {
                        let full_data = data_lines.join("\n");
                        if event_name == "endpoint" && !found_endpoint {
                            found_endpoint = true;
                            let _ = endpoint_tx.send(full_data.clone()).await;
                        } else if let Ok(val) = serde_json::from_str::<serde_json::Value>(&full_data) {
                            let _ = tx.send(val);
                        }
                    }
                }
            }
        }
    });

    let endpoint_path = match tokio::time::timeout(std::time::Duration::from_secs(6), endpoint_rx.recv()).await {
        Ok(Some(ep)) => ep,
        _ => return Err("SSE stream did not send an 'endpoint' event within timeout".to_string()),
    };

    let post_url = resolve_mcp_endpoint_url(target_url, &endpoint_path);

    // 1. Initialize
    let init_payload = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "staggi",
                "version": "0.1.22"
            }
        }
    });

    let req_init = client.post(&post_url).json(&init_payload);
    let req_init = apply_mcp_auth(req_init, api_key, auth_header);
    let init_res = req_init.send().await.map_err(|e| format!("Failed to send initialize: {}", e))?;

    if init_res.status().is_success() {
        let text = init_res.text().await.unwrap_or_default();
        if !text.contains("\"result\"") {
            let _ = tokio::time::timeout(std::time::Duration::from_secs(3), async {
                while let Some(msg) = rx.recv().await {
                    if msg.get("id").and_then(|i| i.as_i64()) == Some(1) {
                        break;
                    }
                }
            }).await;
        }
    }

    // 2. Initialized notification
    let notif_payload = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
    });
    let req_notif = client.post(&post_url).json(&notif_payload);
    let req_notif = apply_mcp_auth(req_notif, api_key, auth_header);
    let _ = req_notif.send().await;

    tokio::time::sleep(std::time::Duration::from_millis(150)).await;

    // 3. List tools
    let tools_payload = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list",
        "params": {}
    });
    let req_tools = client.post(&post_url).json(&tools_payload);
    let req_tools = apply_mcp_auth(req_tools, api_key, auth_header);
    let tools_res = req_tools.send().await.map_err(|e| format!("Failed to send tools/list: {}", e))?;

    let mut tools_json: Option<serde_json::Value> = None;
    if tools_res.status().is_success() {
        let text = tools_res.text().await.unwrap_or_default();
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
            if val.get("result").and_then(|r| r.get("tools")).is_some() {
                tools_json = Some(val);
            }
        }
    }

    if tools_json.is_none() {
        let wait_res = tokio::time::timeout(std::time::Duration::from_secs(6), async {
            while let Some(msg) = rx.recv().await {
                if msg.get("id").and_then(|i| i.as_i64()) == Some(2)
                    || msg.get("result").and_then(|r| r.get("tools")).is_some() {
                    return Some(msg);
                }
            }
            None
        }).await;

        if let Ok(Some(msg)) = wait_res {
            tools_json = Some(msg);
        }
    }

    let mut result_tools = Vec::new();
    if let Some(json) = tools_json {
        if let Some(tools_arr) = json.get("result").and_then(|r| r.get("tools")).and_then(|t| t.as_array()) {
            for t in tools_arr {
                if let Some(name) = t.get("name").and_then(|n| n.as_str()) {
                    let desc = t.get("description").and_then(|d| d.as_str()).map(|s| s.to_string());
                    let schema = t.get("inputSchema").cloned();
                    result_tools.push(McpTool {
                        name: name.to_string(),
                        description: desc,
                        input_schema: schema,
                    });
                }
            }
        }
    }

    Ok(result_tools)
}

pub fn extract_tools_from_value(val: &serde_json::Value) -> Vec<McpTool> {
    let mut tools = Vec::new();

    let raw_tools = val
        .get("result")
        .and_then(|r| r.get("tools").and_then(|t| t.as_array()).or_else(|| r.as_array()))
        .or_else(|| val.get("tools").and_then(|t| t.as_array()));

    if let Some(arr) = raw_tools {
        for item in arr {
            if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                let desc = item.get("description").and_then(|d| d.as_str()).map(String::from);
                let schema = item.get("inputSchema").cloned();
                tools.push(McpTool {
                    name: name.to_string(),
                    description: desc,
                    input_schema: schema,
                });
            }
        }
    }

    tools
}

pub fn extract_tools_from_raw_text(text: &str) -> Vec<McpTool> {
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(text) {
        let tools = extract_tools_from_value(&val);
        if !tools.is_empty() {
            return tools;
        }
    }

    // Try parsing SSE event data chunks
    let mut tools = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("data:") {
            let data_content = trimmed[5..].trim();
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(data_content) {
                let found = extract_tools_from_value(&val);
                if !found.is_empty() {
                    tools = found;
                    break;
                }
            }
        }
    }
    tools
}

pub async fn query_direct_http_mcp_tools(
    client: &reqwest::Client,
    target_url: &str,
    api_key: Option<&str>,
    auth_header: Option<&str>,
) -> Result<Vec<McpTool>, String> {
    let trimmed = target_url.trim_end_matches('/');
    let mut candidate_urls = vec![target_url.to_string()];
    if !trimmed.ends_with("/mcp") {
        candidate_urls.push(format!("{}/mcp", trimmed));
    }
    if !trimmed.ends_with("/sse") {
        candidate_urls.push(format!("{}/sse", trimmed));
    }

    let mut last_err = String::new();

    for url in candidate_urls {
        // Step 1: Standard MCP Handshake (initialize -> notifications/initialized)
        let init_payload = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "clientInfo": {
                    "name": "staggi",
                    "version": "0.1.22"
                }
            }
        });

        let mut req_init = client.post(&url)
            .header("Accept", "application/json, text/event-stream")
            .json(&init_payload);
        req_init = apply_mcp_auth(req_init, api_key, auth_header);

        let mut session_id: Option<String> = None;
        let mut did_handshake = false;

        if let Ok(res_init) = req_init.send().await {
            let status = res_init.status();
            if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
                return Err(format!("AUTH_ERROR: Status {}", status.as_u16()));
            }
            if status.is_success() {
                did_handshake = true;
                session_id = res_init.headers().get("mcp-session-id").and_then(|h| h.to_str().ok()).map(String::from);

                let notif_payload = serde_json::json!({
                    "jsonrpc": "2.0",
                    "method": "notifications/initialized"
                });
                let mut notif_req = client.post(&url)
                    .header("Accept", "application/json, text/event-stream")
                    .json(&notif_payload);
                notif_req = apply_mcp_auth(notif_req, api_key, auth_header);
                if let Some(ref sid) = session_id {
                    notif_req = notif_req.header("mcp-session-id", sid);
                }
                let _ = notif_req.send().await;
            }
        }

        // Step 2: Query tools/list
        let tools_payload = serde_json::json!({
            "jsonrpc": "2.0",
            "id": if did_handshake { 2 } else { 1 },
            "method": "tools/list",
            "params": {}
        });

        let mut req_tools = client.post(&url)
            .header("Accept", "application/json, text/event-stream")
            .json(&tools_payload);
        req_tools = apply_mcp_auth(req_tools, api_key, auth_header);
        if let Some(ref sid) = session_id {
            req_tools = req_tools.header("mcp-session-id", sid);
        }

        let res_tools = match req_tools.send().await {
            Ok(r) => r,
            Err(e) => {
                last_err = e.to_string();
                continue;
            }
        };

        let status = res_tools.status();
        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            return Err(format!("AUTH_ERROR: Status {}", status.as_u16()));
        }
        if !status.is_success() {
            last_err = format!("Status {}", status.as_u16());
            continue;
        }

        let text = res_tools.text().await.unwrap_or_default();
        let tools = extract_tools_from_raw_text(&text);
        if !tools.is_empty() {
            return Ok(tools);
        }
    }

    Err(if last_err.is_empty() { "Failed to discover MCP tools via HTTP".to_string() } else { last_err })
}

pub async fn test_mcp_connection(
    endpoint: String,
    transport: String,
    api_key: Option<String>,
    auth_header: Option<String>,
) -> Result<McpTestResult, String> {
    let raw_ep = endpoint.trim();
    if raw_ep.is_empty() {
        return Ok(McpTestResult {
            success: false,
            status: "error".to_string(),
            status_code: None,
            message: "Endpoint URL or command is empty.".to_string(),
            latency_ms: None,
            tools: Vec::new(),
        });
    }

    if raw_ep == "builtin://yahoo-finance"
        || raw_ep.contains("yfinance")
        || raw_ep.contains("yahoo")
        || raw_ep.contains("query1.finance.yahoo.com")
        || transport.to_lowercase().contains("builtin")
        || transport.to_lowercase().contains("native")
    {
        return test_yahoo_finance_mcp().await;
    }

    let transport_lower = transport.to_lowercase();
    let is_http = raw_ep.starts_with("http://")
        || raw_ep.starts_with("https://")
        || raw_ep.contains(".workers.dev")
        || raw_ep.contains(".com")
        || transport_lower.contains("sse")
        || transport_lower.contains("http");

    if is_http {
        let mut target_url = raw_ep.to_string();
        if !target_url.starts_with("http://") && !target_url.starts_with("https://") {
            target_url = format!("https://{}", target_url);
        }

        let start = std::time::Instant::now();
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .build()
            .map_err(|e| format!("Client build error: {}", e))?;

        let is_sse = (transport_lower == "sse" || target_url.ends_with("/sse") || target_url.ends_with("/sse/"))
            && transport_lower != "http";

        let mut discovered_tools: Vec<McpTool> = Vec::new();

        if is_sse {
            match query_mcp_sse_tools(&client, &target_url, api_key.as_deref(), auth_header.as_deref()).await {
                Ok(tools) => {
                    discovered_tools = tools;
                }
                Err(err) => {
                    if err.contains("AUTH_ERROR") {
                        let latency = start.elapsed().as_millis() as u64;
                        return Ok(McpTestResult {
                            success: false,
                            status: "auth_error".to_string(),
                            status_code: Some(401),
                            message: "Authentication failed: API Key or Token is invalid or unauthorized.".to_string(),
                            latency_ms: Some(latency),
                            tools: Vec::new(),
                        });
                    }
                    if let Ok(tools) = query_direct_http_mcp_tools(&client, &target_url, api_key.as_deref(), auth_header.as_deref()).await {
                        discovered_tools = tools;
                    }
                }
            }
        } else {
            match query_direct_http_mcp_tools(&client, &target_url, api_key.as_deref(), auth_header.as_deref()).await {
                Ok(tools) => {
                    discovered_tools = tools;
                }
                Err(err) => {
                    if err.contains("AUTH_ERROR") {
                        let latency = start.elapsed().as_millis() as u64;
                        return Ok(McpTestResult {
                            success: false,
                            status: "auth_error".to_string(),
                            status_code: Some(401),
                            message: "Authentication failed: API Key or Token is invalid or unauthorized.".to_string(),
                            latency_ms: Some(latency),
                            tools: Vec::new(),
                        });
                    }
                }
            }

            // Fallback to SSE discovery if HTTP direct didn't yield tools
            if discovered_tools.is_empty() {
                if let Ok(tools) = query_mcp_sse_tools(&client, &target_url, api_key.as_deref(), auth_header.as_deref()).await {
                    discovered_tools = tools;
                } else {
                    let sse_candidate = format!("{}/sse", target_url.trim_end_matches('/'));
                    if let Ok(tools) = query_mcp_sse_tools(&client, &sse_candidate, api_key.as_deref(), auth_header.as_deref()).await {
                        discovered_tools = tools;
                    }
                }
            }
        }

        if !discovered_tools.is_empty() {
            let latency = start.elapsed().as_millis() as u64;
            let count = discovered_tools.len();
            return Ok(McpTestResult {
                success: true,
                status: "connected".to_string(),
                status_code: Some(200),
                message: format!("Connected successfully • {} tools discovered ({}ms)", count, latency),
                latency_ms: Some(latency),
                tools: discovered_tools,
            });
        }

        let mut req = client.get(&target_url);
        req = apply_mcp_auth(req, api_key.as_deref(), auth_header.as_deref());

        match req.send().await {
            Ok(res) => {
                let latency = start.elapsed().as_millis() as u64;
                let status = res.status();
                let code = status.as_u16();

                if status.is_success() {
                    Ok(McpTestResult {
                        success: true,
                        status: "connected".to_string(),
                        status_code: Some(code),
                        message: format!("Server responsive (HTTP {} OK, {}ms), but tools handshake failed.", code, latency),
                        latency_ms: Some(latency),
                        tools: Vec::new(),
                    })
                } else if code == 401 || code == 403 {
                    Ok(McpTestResult {
                        success: false,
                        status: "auth_error".to_string(),
                        status_code: Some(code),
                        message: format!("Authentication failed (HTTP {}): API Key or Token is required or invalid.", code),
                        latency_ms: Some(latency),
                        tools: Vec::new(),
                    })
                } else {
                    Ok(McpTestResult {
                        success: false,
                        status: "http_error".to_string(),
                        status_code: Some(code),
                        message: format!("Server returned status HTTP {} ({})", code, status.canonical_reason().unwrap_or("Unknown")),
                        latency_ms: Some(latency),
                        tools: Vec::new(),
                    })
                }
            }
            Err(e) => {
                let err_str = e.to_string();
                let is_timeout = e.is_timeout();
                Ok(McpTestResult {
                    success: false,
                    status: "unreachable".to_string(),
                    status_code: None,
                    message: if is_timeout {
                        "Connection timed out (server unreachable or slow).".to_string()
                    } else {
                        format!("Failed to connect to endpoint: {}", err_str)
                    },
                    latency_ms: None,
                    tools: Vec::new(),
                })
            }
        }
    } else {
        let parts: Vec<&str> = raw_ep.split_whitespace().collect();
        let bin = parts.first().unwrap_or(&"");
        if bin.is_empty() {
            return Ok(McpTestResult {
                success: false,
                status: "error".to_string(),
                status_code: None,
                message: "Command binary name is empty.".to_string(),
                latency_ms: None,
                tools: Vec::new(),
            });
        }

        let check_res = std::process::Command::new(bin).arg("--version").output();
        match check_res {
            Ok(output) => {
                let ver = String::from_utf8_lossy(&output.stdout);
                let first_line = ver.lines().next().unwrap_or("Installed");
                Ok(McpTestResult {
                    success: true,
                    status: "ready".to_string(),
                    status_code: None,
                    message: format!("Binary '{}' detected on system ({})", bin, first_line.trim()),
                    latency_ms: None,
                    tools: Vec::new(),
                })
            }
            Err(_) => {
                Ok(McpTestResult {
                    success: true,
                    status: "ready".to_string(),
                    status_code: None,
                    message: format!("Command configured: '{}'", raw_ep),
                    latency_ms: None,
                    tools: Vec::new(),
                })
            }
        }
    }
}

pub async fn call_mcp_tool(
    endpoint: String,
    transport: String,
    tool_name: String,
    arguments: Option<serde_json::Value>,
    api_key: Option<String>,
    auth_header: Option<String>,
) -> Result<serde_json::Value, String> {
    let raw_ep = endpoint.trim();
    if raw_ep.is_empty() {
        return Err("Endpoint URL is empty".to_string());
    }

    if raw_ep == "builtin://yahoo-finance"
        || raw_ep.contains("yfinance")
        || raw_ep.contains("yahoo")
        || raw_ep.contains("query1.finance.yahoo.com")
        || transport.to_lowercase().contains("builtin")
        || transport.to_lowercase().contains("native")
    {
        return call_yahoo_finance_tool(&tool_name, arguments).await;
    }

    let mut target_url = raw_ep.to_string();
    if !target_url.starts_with("http://") && !target_url.starts_with("https://") {
        target_url = format!("https://{}", target_url);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let is_sse = (transport.to_lowercase() == "sse"
        || target_url.ends_with("/sse")
        || target_url.ends_with("/sse/"))
        && transport.to_lowercase() != "http";

    if is_sse {
        let req = client
            .get(&target_url)
            .header("Accept", "text/event-stream")
            .header("Cache-Control", "no-cache");
        let req = apply_mcp_auth(req, api_key.as_deref(), auth_header.as_deref());

        let mut res = req.send().await.map_err(|e| format!("Failed to connect to SSE: {}", e))?;

        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<serde_json::Value>();
        let (endpoint_tx, mut endpoint_rx) = tokio::sync::mpsc::channel::<String>(1);

        tokio::spawn(async move {
            let mut buffer = String::new();
            let mut found_endpoint = false;

            while let Ok(Some(chunk)) = res.chunk().await {
                if let Ok(text) = std::str::from_utf8(&chunk) {
                    buffer.push_str(text);

                    while let Some(pos) = buffer.find("\n\n").or_else(|| buffer.find("\r\n\r\n")) {
                        let sep_len = if buffer[pos..].starts_with("\r\n\r\n") { 4 } else { 2 };
                        let block = buffer[..pos].to_string();
                        buffer = buffer[pos + sep_len..].to_string();

                        let mut event_name = "message".to_string();
                        let mut data_lines = Vec::new();

                        for line in block.lines() {
                            let trimmed = line.trim();
                            if trimmed.starts_with("event:") {
                                event_name = trimmed[6..].trim().to_string();
                            } else if trimmed.starts_with("data:") {
                                data_lines.push(trimmed[5..].trim());
                            }
                        }

                        if !data_lines.is_empty() {
                            let full_data = data_lines.join("\n");
                            if event_name == "endpoint" && !found_endpoint {
                                found_endpoint = true;
                                let _ = endpoint_tx.send(full_data.clone()).await;
                            } else if let Ok(val) = serde_json::from_str::<serde_json::Value>(&full_data) {
                                let _ = tx.send(val);
                            }
                        }
                    }
                }
            }
        });

        let endpoint_path = match tokio::time::timeout(std::time::Duration::from_secs(6), endpoint_rx.recv()).await {
            Ok(Some(ep)) => ep,
            _ => return Err("SSE stream did not send endpoint event within timeout".to_string()),
        };

        let post_url = resolve_mcp_endpoint_url(&target_url, &endpoint_path);

        // Initialize
        let init_payload = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": { "name": "staggi", "version": "0.1.22" }
            }
        });
        let req_init = client.post(&post_url).json(&init_payload);
        let req_init = apply_mcp_auth(req_init, api_key.as_deref(), auth_header.as_deref());
        let mut session_id: Option<String> = None;
        if let Ok(init_res) = req_init.send().await {
            session_id = init_res.headers().get("mcp-session-id")
                .or_else(|| init_res.headers().get("Mcp-Session-Id"))
                .or_else(|| init_res.headers().get("MCP-Session-ID"))
                .and_then(|h| h.to_str().ok())
                .map(String::from);
        }

        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        // Drain initialize response (id: 1) and check if sessionId is in the body
        let _ = tokio::time::timeout(std::time::Duration::from_secs(3), async {
            while let Some(msg) = rx.recv().await {
                if msg.get("id").and_then(|i| i.as_i64()) == Some(1) {
                    if session_id.is_none() {
                        if let Some(sid) = msg.pointer("/result/sessionId").and_then(|s| s.as_str()) {
                            session_id = Some(sid.to_string());
                        }
                    }
                    break;
                }
            }
        }).await;

        // Notification
        let notif_payload = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        });
        let mut req_notif = client.post(&post_url).json(&notif_payload);
        req_notif = apply_mcp_auth(req_notif, api_key.as_deref(), auth_header.as_deref());
        if let Some(ref sid) = session_id {
            req_notif = req_notif.header("mcp-session-id", sid);
        }
        let _ = req_notif.send().await;

        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        // Call tool
        let call_payload = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 99,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments.unwrap_or_else(|| serde_json::json!({}))
            }
        });
        let mut req_call = client.post(&post_url).json(&call_payload);
        req_call = apply_mcp_auth(req_call, api_key.as_deref(), auth_header.as_deref());
        if let Some(ref sid) = session_id {
            req_call = req_call.header("mcp-session-id", sid);
        }
        let call_res = req_call.send().await.map_err(|e| format!("Failed to call tool: {}", e))?;

        if call_res.status().is_success() {
            let text = call_res.text().await.unwrap_or_default();
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                if val.get("id").and_then(|i| i.as_i64()) == Some(99) {
                    return Ok(val);
                }
            }
        }

        let wait_call = tokio::time::timeout(std::time::Duration::from_secs(12), async {
            while let Some(msg) = rx.recv().await {
                if msg.get("id").and_then(|i| i.as_i64()) == Some(99) {
                    return Some(msg);
                }
            }
            None
        }).await;

        if let Ok(Some(msg)) = wait_call {
            return Ok(msg);
        }

        Err("Timeout waiting for tool response from MCP server".to_string())
    } else {
        // Direct HTTP tool call with full MCP Streamable HTTP handshake
        let mut candidate_urls = vec![target_url.to_string()];
        let trimmed = target_url.trim_end_matches('/');
        if !trimmed.ends_with("/mcp") {
            candidate_urls.push(format!("{}/mcp", trimmed));
        }
        if !trimmed.ends_with("/sse") {
            candidate_urls.push(format!("{}/sse", trimmed));
        }

        let call_payload = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 99,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments.unwrap_or_else(|| serde_json::json!({}))
            }
        });

        let mut last_err = String::new();

        for url in candidate_urls {
            // 1. Send initialize first to establish session and get mcp-session-id
            let init_payload = serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "clientInfo": {
                        "name": "staggi",
                        "version": "0.1.22"
                    }
                }
            });

            let mut req_init = client.post(&url)
                .header("Accept", "application/json, text/event-stream")
                .json(&init_payload);
            req_init = apply_mcp_auth(req_init, api_key.as_deref(), auth_header.as_deref());

            let mut session_id: Option<String> = None;
            let mut init_succeeded = false;

            if let Ok(res_init) = req_init.send().await {
                let init_status = res_init.status();
                if init_status.is_success() {
                    init_succeeded = true;
                    // Check header case variants
                    session_id = res_init.headers().get("mcp-session-id")
                        .or_else(|| res_init.headers().get("Mcp-Session-Id"))
                        .or_else(|| res_init.headers().get("MCP-Session-ID"))
                        .and_then(|h| h.to_str().ok())
                        .map(String::from);

                    let init_body = res_init.text().await.unwrap_or_default();
                    if session_id.is_none() {
                        if let Ok(body_json) = serde_json::from_str::<serde_json::Value>(&init_body) {
                            if let Some(sid) = body_json.pointer("/result/sessionId").and_then(|s| s.as_str()) {
                                session_id = Some(sid.to_string());
                            }
                        }
                    }

                    // 2. Send notifications/initialized
                    let notif_payload = serde_json::json!({
                        "jsonrpc": "2.0",
                        "method": "notifications/initialized"
                    });
                    let mut notif_req = client.post(&url)
                        .header("Accept", "application/json, text/event-stream")
                        .json(&notif_payload);
                    notif_req = apply_mcp_auth(notif_req, api_key.as_deref(), auth_header.as_deref());
                    if let Some(ref sid) = session_id {
                        notif_req = notif_req.header("mcp-session-id", sid);
                    }
                    let _ = notif_req.send().await;
                }
            }

            // 3. Send tools/call with session_id header
            let mut req = client.post(&url)
                .header("Accept", "application/json, text/event-stream")
                .json(&call_payload);
            req = apply_mcp_auth(req, api_key.as_deref(), auth_header.as_deref());
            if let Some(ref sid) = session_id {
                req = req.header("mcp-session-id", sid);
            }

            let res = match req.send().await {
                Ok(r) => r,
                Err(e) => {
                    last_err = format!("Direct tool call failed on {}: {}", url, e);
                    continue;
                }
            };

            let status = res.status();
            if status == reqwest::StatusCode::METHOD_NOT_ALLOWED || status == reqwest::StatusCode::NOT_FOUND {
                last_err = format!("HTTP {} on {}", status.as_u16(), url);
                continue;
            }

            let text = res.text().await.unwrap_or_default();

            // Check if server returned 400 Bad Request: Missing session ID (or error requiring session)
            let is_missing_session = status.as_u16() == 400 && text.to_lowercase().contains("session");
            if is_missing_session && !init_succeeded {
                // If we didn't succeed with initialize earlier, retry full handshake now
                let init_payload = serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": { "tools": {} },
                        "clientInfo": { "name": "staggi", "version": "0.1.22" }
                    }
                });
                let mut retry_init = client.post(&url)
                    .header("Accept", "application/json, text/event-stream")
                    .json(&init_payload);
                retry_init = apply_mcp_auth(retry_init, api_key.as_deref(), auth_header.as_deref());
                if let Ok(retry_init_res) = retry_init.send().await {
                    let mut new_session_id = retry_init_res.headers().get("mcp-session-id")
                        .or_else(|| retry_init_res.headers().get("Mcp-Session-Id"))
                        .or_else(|| retry_init_res.headers().get("MCP-Session-ID"))
                        .and_then(|h| h.to_str().ok())
                        .map(String::from);
                    let body_str = retry_init_res.text().await.unwrap_or_default();
                    if new_session_id.is_none() {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body_str) {
                            if let Some(sid) = val.pointer("/result/sessionId").and_then(|s| s.as_str()) {
                                new_session_id = Some(sid.to_string());
                            }
                        }
                    }

                    if let Some(ref sid) = new_session_id {
                        let notif_payload = serde_json::json!({
                            "jsonrpc": "2.0",
                            "method": "notifications/initialized"
                        });
                        let mut notif_req = client.post(&url).json(&notif_payload).header("mcp-session-id", sid);
                        notif_req = apply_mcp_auth(notif_req, api_key.as_deref(), auth_header.as_deref());
                        let _ = notif_req.send().await;

                        let mut retry_call = client.post(&url)
                            .header("Accept", "application/json, text/event-stream")
                            .header("mcp-session-id", sid)
                            .json(&call_payload);
                        retry_call = apply_mcp_auth(retry_call, api_key.as_deref(), auth_header.as_deref());
                        if let Ok(final_res) = retry_call.send().await {
                            let final_text = final_res.text().await.unwrap_or_default();
                            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&final_text) {
                                return Ok(val);
                            }
                        }
                    }
                }
            }

            // Parse response body as JSON or extract from SSE stream format if returned as event-stream
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                return Ok(val);
            }

            // Check if returned as SSE data lines
            for line in text.lines() {
                let trimmed_line = line.trim();
                if trimmed_line.starts_with("data:") {
                    let data_part = trimmed_line[5..].trim();
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(data_part) {
                        return Ok(val);
                    }
                }
            }

            last_err = format!("Error parsing tool response from {}: {}", url, text);
        }

        Err(if last_err.is_empty() { "Failed to call MCP tool via direct HTTP".to_string() } else { last_err })
    }
}

fn format_civil_date(ts: i64) -> String {
    let days = ts / 86400;
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1024 + doe / 1461 - doe / 14244) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{:02}/{:02}/{:04}", d, m, y)
}

pub async fn test_yahoo_finance_mcp() -> Result<McpTestResult, String> {
    let start = std::time::Instant::now();
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let url = "https://query1.finance.yahoo.com/v8/finance/chart/PETR4.SA?interval=1d&range=1d";
    let ping_res = client.get(url).send().await;
    let latency = start.elapsed().as_millis() as u64;

    let tools = vec![
        McpTool {
            name: "get_stock_quote".to_string(),
            description: Some("Retorna cotação em tempo real, variação diária, máxima, mínima, volume e moeda de ativos da B3 (ex: PETR4.SA, VALE3.SA), NYSE/Nasdaq (AAPL, NVDA), BDRs e índices.".to_string()),
            input_schema: Some(serde_json::json!({
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Ticker symbol (e.g. PETR4, VALE3, AAPL, ITUB4)"
                    }
                },
                "required": ["symbol"]
            })),
        },
        McpTool {
            name: "get_historical_dividends".to_string(),
            description: Some("Retorna histórico de proventos declarados (dividendos e JCP), valores pagos e datas de corte para ações da B3 e globais.".to_string()),
            input_schema: Some(serde_json::json!({
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Ticker symbol (e.g. PETR4, BBAS3)"
                    }
                },
                "required": ["symbol"]
            })),
        },
        McpTool {
            name: "get_market_news".to_string(),
            description: Some("Consulta notícias financeiras recentes e comunicados corporativos via Yahoo Finance para os ativos informados.".to_string()),
            input_schema: Some(serde_json::json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Códigos de ativos ou termos de busca (ex: PETR4, VALE3, mercado)"
                    }
                }
            })),
        },
    ];

    match ping_res {
        Ok(res) if res.status().is_success() => {
            Ok(McpTestResult {
                success: true,
                status: "connected".to_string(),
                status_code: Some(200),
                message: format!("Conectado ao Yahoo Finance MCP • 3 ferramentas descobertas ({}ms)", latency),
                latency_ms: Some(latency),
                tools,
            })
        }
        Ok(res) => {
            let code = res.status().as_u16();
            Ok(McpTestResult {
                success: true,
                status: "connected".to_string(),
                status_code: Some(code),
                message: format!("Servidor Yahoo Finance acessível (HTTP {} • {}ms)", code, latency),
                latency_ms: Some(latency),
                tools,
            })
        }
        Err(e) => {
            Ok(McpTestResult {
                success: false,
                status: "unreachable".to_string(),
                status_code: None,
                message: format!("Falha de conexão com a API do Yahoo Finance: {}", e),
                latency_ms: Some(latency),
                tools: Vec::new(),
            })
        }
    }
}

pub async fn call_yahoo_finance_tool(
    tool_name: &str,
    arguments: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let args = arguments.unwrap_or_else(|| serde_json::json!({}));
    let raw_symbol = args.get("symbol")
        .or_else(|| args.get("ticker"))
        .or_else(|| args.get("query"))
        .and_then(|v| v.as_str())
        .unwrap_or("PETR4.SA")
        .trim();

    let mut symbol = raw_symbol.to_uppercase();
    if (symbol.ends_with('3') || symbol.ends_with('4') || symbol.ends_with("11") || symbol.ends_with('5') || symbol.ends_with('6'))
        && !symbol.contains('.') {
        symbol = format!("{}.SA", symbol);
    }

    match tool_name {
        "get_stock_quote" | "quote" | "get_quote" => {
            let url = format!(
                "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1d&range=5d",
                symbol
            );
            let res = client.get(&url).send().await.map_err(|e| format!("Falha ao consultar Yahoo Finance: {}", e))?;
            let status = res.status();
            if !status.is_success() {
                return Err(format!("Yahoo Finance retornou status HTTP {}", status.as_u16()));
            }
            let text = res.text().await.map_err(|e| e.to_string())?;
            let chart_val: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;

            let meta = chart_val.get("chart")
                .and_then(|c| c.get("result"))
                .and_then(|r| r.get(0))
                .and_then(|item| item.get("meta"));

            if let Some(m) = meta {
                let regular_market_price = m.get("regularMarketPrice").and_then(|p| p.as_f64()).unwrap_or(0.0);
                let previous_close = m.get("chartPreviousClose").or_else(|| m.get("previousClose")).and_then(|p| p.as_f64()).unwrap_or(regular_market_price);
                let currency = m.get("currency").and_then(|c| c.as_str()).unwrap_or("BRL");
                let exchange_name = m.get("exchangeName").and_then(|e| e.as_str()).unwrap_or("SAO");
                let high = m.get("regularMarketDayHigh").and_then(|p| p.as_f64()).unwrap_or(regular_market_price);
                let low = m.get("regularMarketDayLow").and_then(|p| p.as_f64()).unwrap_or(regular_market_price);
                let volume = m.get("regularMarketVolume").and_then(|p| p.as_i64()).unwrap_or(0);

                let change = regular_market_price - previous_close;
                let change_percent = if previous_close > 0.0 { (change / previous_close) * 100.0 } else { 0.0 };

                let result_str = format!(
                    "Ativo: {}\nCotação Atual: {} {:.2}\nVariação Diária: {:+.2}%\nMáxima do Dia: {} {:.2}\nMínima do Dia: {} {:.2}\nVolume: {}\nMercado/Bolsa: {}\nHorário de Referência: Tempo Real",
                    symbol, currency, regular_market_price, change_percent, currency, high, currency, low, volume, exchange_name
                );

                Ok(serde_json::json!({
                    "content": [
                        {
                            "type": "text",
                            "text": result_str
                        }
                    ],
                    "metadata": {
                        "symbol": symbol,
                        "price": regular_market_price,
                        "currency": currency,
                        "change": change,
                        "changePercent": change_percent
                    }
                }))
            } else {
                Err(format!("Dados não encontrados para o ticker {}", symbol))
            }
        }
        "get_historical_dividends" | "dividends" | "get_dividends" => {
            let url = format!(
                "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1d&range=2y&events=div",
                symbol
            );
            let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
            let text = res.text().await.map_err(|e| e.to_string())?;
            let val: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;

            let events = val.get("chart")
                .and_then(|c| c.get("result"))
                .and_then(|r| r.get(0))
                .and_then(|item| item.get("events"))
                .and_then(|ev| ev.get("dividends"));

            let mut div_lines = Vec::new();
            if let Some(divs_obj) = events.and_then(|d| d.as_object()) {
                for (_k, div_val) in divs_obj {
                    let amount = div_val.get("amount").and_then(|a| a.as_f64()).unwrap_or(0.0);
                    let date_ts = div_val.get("date").and_then(|d| d.as_i64()).unwrap_or(0);
                    let date_str = if date_ts > 0 { format_civil_date(date_ts) } else { "-".to_string() };
                    div_lines.push(format!("| Dividendo/JCP | R$ {:.4} | {} |", amount, date_str));
                }
            }

            let response_text = if !div_lines.is_empty() {
                format!(
                    "Histórico de Proventos Declarados para {}:\n\n| Tipo | Valor por Ação | Data Ex |\n| --- | --- | --- |\n{}",
                    symbol, div_lines.join("\n")
                )
            } else {
                format!("Nenhum provento distribuído localizado no período recente para {}.", symbol)
            };

            Ok(serde_json::json!({
                "content": [
                    {
                        "type": "text",
                        "text": response_text
                    }
                ]
            }))
        }
        "get_market_news" | "news" | "get_news" => {
            let news_query = args.get("query").and_then(|q| q.as_str()).unwrap_or(&symbol);
            let search_url = format!("https://query1.finance.yahoo.com/v1/finance/search?q={}&quotesCount=2&newsCount=6", news_query);
            let mut news_text = format!("Notícias de Mercado para {}:\n", news_query);

            if let Ok(res) = client.get(&search_url).send().await {
                if let Ok(text) = res.text().await {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(news_arr) = json.get("news").and_then(|n| n.as_array()) {
                            for item in news_arr.iter().take(5) {
                                let title = item.get("title").and_then(|t| t.as_str()).unwrap_or("");
                                let link = item.get("link").and_then(|l| l.as_str()).unwrap_or("");
                                let publisher = item.get("publisher").and_then(|p| p.as_str()).unwrap_or("Yahoo Finance");
                                if !title.is_empty() {
                                    news_text.push_str(&format!("\n- **{}** ({})\n  Link: {}", title, publisher, link));
                                }
                            }
                        }
                    }
                }
            }

            Ok(serde_json::json!({
                "content": [
                    {
                        "type": "text",
                        "text": news_text
                    }
                ]
            }))
        }
        _ => Err(format!("Ferramenta '{}' desconhecida no Yahoo Finance MCP", tool_name))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_mcp_endpoint_url_absolute() {
        assert_eq!(
            resolve_mcp_endpoint_url("http://localhost:8000/sse", "http://localhost:8000/messages"),
            "http://localhost:8000/messages"
        );
    }

    #[test]
    fn test_resolve_mcp_endpoint_url_relative_slash() {
        assert_eq!(
            resolve_mcp_endpoint_url("http://localhost:8000/sse", "/messages"),
            "http://localhost:8000/messages"
        );
        assert_eq!(
            resolve_mcp_endpoint_url("https://api.example.com/v1/sse", "/v1/messages"),
            "https://api.example.com/v1/messages"
        );
    }

    #[test]
    fn test_resolve_mcp_endpoint_url_relative_no_slash() {
        assert_eq!(
            resolve_mcp_endpoint_url("http://localhost:8000", "messages"),
            "http://localhost:8000/messages"
        );
    }
}

