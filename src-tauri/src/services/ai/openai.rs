use crate::models::ai::{ChatTurn, DiscoveredModel};

pub fn get_fallback_openai_models() -> Vec<DiscoveredModel> {
    vec![
        DiscoveredModel {
            id: "gpt-4o".to_string(),
            name: "GPT-4o (Recommended)".to_string(),
            description: "Flagship intelligent multimodal model".to_string(),
            context_window: "128k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: true,
        },
        DiscoveredModel {
            id: "gpt-4o-mini".to_string(),
            name: "GPT-4o Mini".to_string(),
            description: "Fast and lightweight for frequent financial queries".to_string(),
            context_window: "128k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "o3-mini".to_string(),
            name: "o3-mini (Reasoning)".to_string(),
            description: "High-effort mathematical and quantitative reasoning model".to_string(),
            context_window: "200k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: true,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "o1".to_string(),
            name: "o1 (Full Reasoning)".to_string(),
            description: "Deep reasoning model for complex financial architectures".to_string(),
            context_window: "200k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: true,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "o1-mini".to_string(),
            name: "o1-mini".to_string(),
            description: "Fast reasoning for math and code generation".to_string(),
            context_window: "128k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: true,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "gpt-4.5-preview".to_string(),
            name: "GPT-4.5 Preview (Orion)".to_string(),
            description: "Next-generation knowledge and encyclopedic context".to_string(),
            context_window: "128k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "chatgpt-4o-latest".to_string(),
            name: "ChatGPT-4o Latest".to_string(),
            description: "Continuously updated dynamic ChatGPT-4o model".to_string(),
            context_window: "128k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "gpt-4-turbo".to_string(),
            name: "GPT-4 Turbo".to_string(),
            description: "High-precision traditional structured analysis".to_string(),
            context_window: "128k tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
    ]
}

pub async fn list_openai_models_api(key: &str) -> Result<Vec<DiscoveredModel>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", key))
        .send()
        .await
        .map_err(|e| format!("Network error querying OpenAI models: {}", e))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("OpenAI API returned status {}: {}", status, body));
    }

    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Error parsing OpenAI models response: {}", e))?;

    let mut results = Vec::new();
    if let Some(models) = json.get("data").and_then(|d| d.as_array()) {
        for m in models {
            if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                let id_lower = id.to_lowercase();

                let is_chat = id_lower.starts_with("gpt-4")
                    || id_lower.starts_with("o1")
                    || id_lower.starts_with("o3")
                    || id_lower.starts_with("chatgpt-4o")
                    || id_lower.starts_with("gpt-3.5-turbo");

                let is_excluded = id_lower.contains("audio")
                    || id_lower.contains("realtime")
                    || id_lower.contains("transcribe")
                    || id_lower.contains("tts")
                    || id_lower.contains("search-preview")
                    || id_lower.contains("instruct");

                if is_chat && !is_excluded {
                    let is_reasoning = id_lower.starts_with("o1") || id_lower.starts_with("o3");
                    let is_rec = id == "gpt-4o";
                    let ctx = if is_reasoning {
                        "200k tokens"
                    } else {
                        "128k tokens"
                    };

                    let desc = if id == "gpt-4o" {
                        "Flagship Multimodal & High Speed"
                    } else if id == "gpt-4o-mini" {
                        "Fast & Cost-Efficient"
                    } else if id == "o3-mini" {
                        "High-Effort Mathematical & Quantitative Reasoning"
                    } else if id == "o1" {
                        "Deep Reasoning & Chain-of-Thought"
                    } else if id.contains("4.5") {
                        "Next-Generation Advanced Context & Encyclopedic Knowledge"
                    } else {
                        "OpenAI Official Language Model"
                    };

                    results.push(DiscoveredModel {
                        id: id.to_string(),
                        name: id.to_string(),
                        description: desc.to_string(),
                        context_window: ctx.to_string(),
                        supports_tools: true,
                        supports_reasoning: is_reasoning,
                        is_recommended: is_rec,
                    });
                }
            }
        }
    }

    results.sort_by(|a, b| {
        if a.is_recommended {
            return std::cmp::Ordering::Less;
        }
        if b.is_recommended {
            return std::cmp::Ordering::Greater;
        }
        b.id.cmp(&a.id)
    });

    if results.is_empty() {
        results = get_fallback_openai_models();
    }

    Ok(results)
}

pub async fn test_openai_connection(key: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", key))
        .send()
        .await
        .map_err(|e| format!("Network error connecting to OpenAI: {}", e))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("OpenAI returned error (Status {}): {}", status, body));
    }
    Ok("CONEXAO_OK".to_string())
}

pub async fn ask_openai(
    key: &str,
    model: Option<String>,
    prompt: &str,
    history: Option<Vec<ChatTurn>>,
    system_instruction: Option<String>,
    enforcement_level: Option<String>,
) -> Result<String, String> {
    let chosen_model = model.filter(|m| !m.trim().is_empty()).unwrap_or_else(|| "gpt-4o".to_string());
    let enf = enforcement_level.unwrap_or_else(|| "medium".to_string()).to_lowercase();
    let url = "https://api.openai.com/v1/chat/completions";
    let client = reqwest::Client::new();

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
            let clean = turn.text.trim();
            if !clean.is_empty() && !(clean.starts_with('{') && clean.contains("\"candidates\"")) {
                messages.push(serde_json::json!({
                    "role": role,
                    "content": clean
                }));
            }
        }
    }
    messages.push(serde_json::json!({
        "role": "user",
        "content": prompt.trim()
    }));

    let is_reasoning_model = chosen_model.starts_with("o1") || chosen_model.starts_with("o3");
    let mut payload = serde_json::json!({
        "model": chosen_model,
        "messages": messages,
    });

    if is_reasoning_model {
        let effort = match enf.as_str() {
            "low" => "low",
            "high" => "high",
            _ => "medium",
        };
        payload["reasoning_effort"] = serde_json::json!(effort);
    } else {
        let temp = if enf == "high" { 0.1 } else if enf == "low" { 0.4 } else { 0.2 };
        payload["temperature"] = serde_json::json!(temp);
    }

    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error connecting to OpenAI: {}", e))?;

    let status = res.status();
    let body = res.text().await.map_err(|e| format!("Error reading OpenAI response: {}", e))?;
    if !status.is_success() {
        return Err(format!("OpenAI returned error (Status {}): {}", status, body));
    }

    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Error parsing OpenAI JSON response: {}", e))?;
    let content = json
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c0| c0.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|s| s.as_str())
        .unwrap_or_default();

    Ok(content.to_string())
}
