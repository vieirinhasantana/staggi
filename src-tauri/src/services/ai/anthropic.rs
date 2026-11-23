use crate::models::ai::{ChatTurn, DiscoveredModel};

pub fn get_fallback_anthropic_models() -> Vec<DiscoveredModel> {
    vec![
        DiscoveredModel {
            id: "claude-3-7-sonnet-latest".to_string(),
            name: "Claude 3.7 Sonnet (Hybrid)".to_string(),
            description: "Recommended • State-of-the-art hybrid model with Extended Thinking".to_string(),
            context_window: "200k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: true,
            is_recommended: true,
        },
        DiscoveredModel {
            id: "claude-3-5-sonnet-latest".to_string(),
            name: "Claude 3.5 Sonnet".to_string(),
            description: "Benchmark for financial reasoning, coding, and tool use".to_string(),
            context_window: "200k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "claude-3-5-haiku-latest".to_string(),
            name: "Claude 3.5 Haiku".to_string(),
            description: "Ultra-fast responses with high contextual intelligence".to_string(),
            context_window: "200k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "claude-3-opus-latest".to_string(),
            name: "Claude 3 Opus".to_string(),
            description: "Deep strategic and institutional analytical model".to_string(),
            context_window: "200k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "claude-3-sonnet-20240229".to_string(),
            name: "Claude 3 Sonnet".to_string(),
            description: "Balanced traditional Claude 3 generation model".to_string(),
            context_window: "200k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "claude-3-haiku-20240307".to_string(),
            name: "Claude 3 Haiku".to_string(),
            description: "Compact traditional generation model".to_string(),
            context_window: "200k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
    ]
}

pub async fn list_anthropic_models_api(key: &str) -> Result<Vec<DiscoveredModel>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await;

    let mut results = Vec::new();

    if let Ok(response) = res {
        if response.status().is_success() {
            if let Ok(body) = response.text().await {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                    if let Some(models) = json.get("data").and_then(|d| d.as_array()) {
                        for m in models {
                            if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                                let display = m
                                    .get("display_name")
                                    .and_then(|d| d.as_str())
                                    .unwrap_or(id);
                                let is_reasoning = id.contains("3-7") || id.contains("thinking");
                                let is_rec = id.contains("claude-3-7-sonnet");

                                results.push(DiscoveredModel {
                                    id: id.to_string(),
                                    name: display.to_string(),
                                    description: if is_reasoning {
                                        "Hybrid State-of-the-Art with Extended Thinking"
                                    } else {
                                        "Anthropic Claude Production Model"
                                    }
                                    .to_string(),
                                    context_window: "200k tokens".to_string(),
                                    supports_tools: true,
                                    supports_reasoning: is_reasoning,
                                    is_recommended: is_rec,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    if results.is_empty() {
        results = get_fallback_anthropic_models();
    }

    Ok(results)
}

pub async fn test_anthropic_connection(key: &str, model: Option<String>) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| format!("Network error connecting to Anthropic: {}", e))?;

    let status = res.status();
    if status.is_success() {
        return Ok("CONEXAO_OK".to_string());
    }

    let chosen_model = model
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "claude-3-5-haiku-latest".to_string());
    let payload = serde_json::json!({
        "model": chosen_model,
        "max_tokens": 5,
        "messages": [{ "role": "user", "content": "Ping" }]
    });
    let res_post = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error connecting to Anthropic: {}", e))?;

    let post_status = res_post.status();
    let post_body = res_post.text().await.unwrap_or_default();
    if !post_status.is_success() {
        return Err(format!(
            "Anthropic returned error (Status {}): {}",
            post_status, post_body
        ));
    }
    Ok("CONEXAO_OK".to_string())
}

pub async fn ask_anthropic(
    key: &str,
    model: Option<String>,
    prompt: &str,
    history: Option<Vec<ChatTurn>>,
    system_instruction: Option<String>,
    enforcement_level: Option<String>,
) -> Result<String, String> {
    let chosen_model = model
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "claude-3-7-sonnet-latest".to_string());
    let enf = enforcement_level.unwrap_or_else(|| "medium".to_string()).to_lowercase();
    let url = "https://api.anthropic.com/v1/messages";
    let client = reqwest::Client::new();

    let mut messages: Vec<serde_json::Value> = Vec::new();
    if let Some(past_turns) = history {
        for turn in past_turns {
            let role = if turn.role == "user" { "user" } else { "assistant" };
            let clean = turn.text.trim();
            if !clean.is_empty() && !(clean.starts_with('{') && clean.contains("\"candidates\"")) {
                if let Some(last) = messages.last_mut() {
                    if last.get("role").and_then(|r| r.as_str()) == Some(role) {
                        if let Some(last_content) = last.get_mut("content") {
                            if let Some(s) = last_content.as_str() {
                                let merged = format!("{}\n\n{}", s, clean);
                                *last_content = serde_json::Value::String(merged);
                                continue;
                            }
                        }
                    }
                }
                messages.push(serde_json::json!({
                    "role": role,
                    "content": clean
                }));
            }
        }
    }

    if let Some(last) = messages.last_mut() {
        if last.get("role").and_then(|r| r.as_str()) == Some("user") {
            if let Some(last_content) = last.get_mut("content") {
                if let Some(s) = last_content.as_str() {
                    let merged = format!("{}\n\n{}", s, prompt.trim());
                    *last_content = serde_json::Value::String(merged);
                }
            }
        } else {
            messages.push(serde_json::json!({
                "role": "user",
                "content": prompt.trim()
            }));
        }
    } else {
        messages.push(serde_json::json!({
            "role": "user",
            "content": prompt.trim()
        }));
    }

    let is_claude_37 = chosen_model.contains("claude-3-7");
    let mut payload = serde_json::json!({
        "model": chosen_model,
        "messages": messages
    });

    if is_claude_37 {
        let budget = match enf.as_str() {
            "low" => 2048,
            "high" => 16384,
            _ => 8192,
        };
        payload["thinking"] = serde_json::json!({
            "type": "enabled",
            "budget_tokens": budget
        });
        payload["max_tokens"] = serde_json::json!(budget + 4096);
    } else {
        payload["max_tokens"] = serde_json::json!(4096);
        let temp = if enf == "high" { 0.1 } else if enf == "low" { 0.4 } else { 0.2 };
        payload["temperature"] = serde_json::json!(temp);
    }

    if let Some(ref sys) = system_instruction {
        if !sys.trim().is_empty() {
            payload["system"] = serde_json::Value::String(sys.trim().to_string());
        }
    }

    let res = client
        .post(url)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error connecting to Anthropic: {}", e))?;

    let status = res.status();
    let body = res
        .text()
        .await
        .map_err(|e| format!("Error processing Anthropic response: {}", e))?;
    if !status.is_success() {
        return Err(format!(
            "Anthropic returned error (Status {}): {}",
            status, body
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Error parsing Anthropic JSON response: {}", e))?;
    let mut result_text = String::new();
    if let Some(content_arr) = json.get("content").and_then(|c| c.as_array()) {
        for item in content_arr {
            if let Some(txt) = item.get("text").and_then(|t| t.as_str()) {
                result_text.push_str(txt);
            }
        }
    }

    Ok(result_text)
}
