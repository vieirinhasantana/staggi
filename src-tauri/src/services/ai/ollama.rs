use crate::models::ai::{AIModel, ChatTurn};

fn resolve_ollama_endpoint(raw: &str) -> (String, Option<String>) {
    let trimmed = raw.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        if let Some(pos) = trimmed.find("###") {
            let ep = trimmed[..pos].trim_end_matches('/').to_string();
            let token = trimmed[pos + 3..].trim();
            let tok = if token.is_empty() { None } else { Some(token.to_string()) };
            (ep, tok)
        } else {
            (trimmed.trim_end_matches('/').to_string(), None)
        }
    } else if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("ollama") {
        ("http://localhost:11434".to_string(), None)
    } else {
        ("http://localhost:11434".to_string(), Some(trimmed.to_string()))
    }
}

pub async fn list_ollama_models_api(key_or_endpoint: &str) -> Result<Vec<AIModel>, String> {
    let (endpoint, token) = resolve_ollama_endpoint(key_or_endpoint);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/tags", endpoint);
    let mut req = client.get(&url);
    if let Some(ref tok) = token {
        req = req.header("Authorization", format!("Bearer {}", tok));
    }

    let res = req.send().await.map_err(|e| {
        format!(
            "Não foi possível conectar ao Ollama em {}: {}. Certifique-se de que o daemon está ativo (`ollama serve`).",
            endpoint, e
        )
    })?;

    let status = res.status();
    if !status.is_success() {
        return Err(format!(
            "Ollama retornou status HTTP {}: {}",
            status.as_u16(),
            res.text().await.unwrap_or_default()
        ));
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Erro ao decodificar JSON do Ollama: {}", e))?;
    let mut results = Vec::new();

    if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
        for m in models {
            if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                let mut desc_parts = Vec::new();
                if let Some(details) = m.get("details") {
                    if let Some(param) = details.get("parameter_size").and_then(|p| p.as_str()) {
                        desc_parts.push(param.to_string());
                    }
                    if let Some(family) = details.get("family").and_then(|f| f.as_str()) {
                        desc_parts.push(family.to_string());
                    }
                    if let Some(quant) = details.get("quantization_level").and_then(|q| q.as_str()) {
                        desc_parts.push(format!("({})", quant));
                    }
                }
                let desc = if desc_parts.is_empty() {
                    None
                } else {
                    Some(desc_parts.join(" • "))
                };

                results.push(AIModel {
                    id: name.to_string(),
                    name: name.to_string(),
                    description: desc,
                });
            }
        }
    }

    if results.is_empty() {
        results.push(AIModel {
            id: "llama3.2:latest".to_string(),
            name: "Llama 3.2".to_string(),
            description: Some("Meta Llama 3.2 Local (Default)".to_string()),
        });
        results.push(AIModel {
            id: "qwen2.5:latest".to_string(),
            name: "Qwen 2.5".to_string(),
            description: Some("Qwen 2.5 Local".to_string()),
        });
        results.push(AIModel {
            id: "deepseek-r1:latest".to_string(),
            name: "DeepSeek R1".to_string(),
            description: Some("DeepSeek Reasoning Local".to_string()),
        });
    }

    Ok(results)
}

pub async fn test_ollama_connection(key_or_endpoint: &str) -> Result<String, String> {
    let (endpoint, token) = resolve_ollama_endpoint(key_or_endpoint);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/tags", endpoint);
    let mut req = client.get(&url);
    if let Some(ref tok) = token {
        req = req.header("Authorization", format!("Bearer {}", tok));
    }

    let res = req.send().await.map_err(|e| {
        format!(
            "Não foi possível conectar ao Ollama em {}. Verifique se o Ollama está rodando localmente (`ollama serve`). Detalhes: {}",
            endpoint, e
        )
    })?;

    if res.status().is_success() {
        Ok("CONEXAO_OK".to_string())
    } else {
        Err(format!("Ollama retornou HTTP {}", res.status().as_u16()))
    }
}

pub async fn ask_ollama(
    key_or_endpoint: &str,
    model: Option<String>,
    prompt: &str,
    history: Option<Vec<ChatTurn>>,
    system_instruction: Option<String>,
    _enforcement_level: Option<String>,
) -> Result<String, String> {
    let (endpoint, token) = resolve_ollama_endpoint(key_or_endpoint);
    let chosen_model = model
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "llama3.2".to_string());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let mut messages: Vec<serde_json::Value> = Vec::new();
    if let Some(ref sys) = system_instruction {
        if !sys.trim().is_empty() {
            messages.push(serde_json::json!({
                "role": "system",
                "content": sys.trim()
            }));
        }
    }

    if let Some(past_turns) = history {
        for turn in past_turns {
            let role = if turn.role == "user" { "user" } else { "assistant" };
            messages.push(serde_json::json!({
                "role": role,
                "content": turn.text
            }));
        }
    }

    messages.push(serde_json::json!({
        "role": "user",
        "content": prompt
    }));

    let payload = serde_json::json!({
        "model": chosen_model,
        "messages": messages,
        "stream": false,
        "options": {
            "temperature": 0.2
        }
    });

    let url = format!("{}/api/chat", endpoint);
    let mut req = client.post(&url).json(&payload);
    if let Some(ref tok) = token {
        req = req.header("Authorization", format!("Bearer {}", tok));
    }

    let res = req.send().await.map_err(|e| {
        format!(
            "Erro de conexão com o Ollama em {}: {}. Verifique se o modelo '{}' foi baixado no Ollama (`ollama run {}`).",
            endpoint, e, chosen_model, chosen_model
        )
    })?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("Ollama retornou erro (HTTP {}): {}", status.as_u16(), body));
    }

    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Erro ao processar resposta do Ollama: {} (Raw: {})", e, body))?;

    if let Some(content) = json.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_str()) {
        Ok(content.to_string())
    } else if let Some(content) = json.get("response").and_then(|r| r.as_str()) {
        Ok(content.to_string())
    } else {
        Err(format!("Formato de resposta inesperado do Ollama: {}", body))
    }
}
