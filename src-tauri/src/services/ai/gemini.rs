use crate::models::ai::{ChatTurn, DiscoveredModel};

pub fn get_fallback_gemini_models() -> Vec<DiscoveredModel> {
    vec![
        DiscoveredModel {
            id: "gemini-2.0-flash".to_string(),
            name: "Gemini 2.0 Flash (Recommended)".to_string(),
            description: "High speed, multimodal, tool-enabled flagship model".to_string(),
            context_window: "1M tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: true,
        },
        DiscoveredModel {
            id: "gemini-2.0-flash-lite".to_string(),
            name: "Gemini 2.0 Flash-Lite".to_string(),
            description: "Ultra fast with maximum cost and latency efficiency".to_string(),
            context_window: "1M tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "gemini-2.0-pro-exp-02-05".to_string(),
            name: "Gemini 2.0 Pro Experimental".to_string(),
            description: "Highest cognitive reasoning for quant, code, and financial models".to_string(),
            context_window: "2M tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "gemini-2.0-flash-thinking-exp-01-21".to_string(),
            name: "Gemini 2.0 Flash Thinking".to_string(),
            description: "Deep step-by-step reasoning and transparent chain-of-thought".to_string(),
            context_window: "1M tokens".to_string(),
            supports_tools: false,
            supports_reasoning: true,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "gemini-1.5-pro".to_string(),
            name: "Gemini 1.5 Pro".to_string(),
            description: "Massive context window for long-form analysis".to_string(),
            context_window: "2M tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
        DiscoveredModel {
            id: "gemini-1.5-flash".to_string(),
            name: "Gemini 1.5 Flash".to_string(),
            description: "Balanced speed and analytical intelligence".to_string(),
            context_window: "1M tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
    ]
}

pub async fn list_gemini_models_api(key: &str) -> Result<Vec<DiscoveredModel>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models?key={}",
        key
    );
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error querying Gemini models: {}", e))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("Google Gemini API returned status {}: {}", status, body));
    }

    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Error parsing Gemini models response: {}", e))?;

    let mut results = Vec::new();
    if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
        for m in models {
            let supports_generate = m.get("supportedGenerationMethods")
                .and_then(|s| s.as_array())
                .map(|arr| arr.iter().any(|v| v.as_str() == Some("generateContent")))
                .unwrap_or(false);

            if !supports_generate {
                continue;
            }

            if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                let clean_id = name.strip_prefix("models/").unwrap_or(name);

                if clean_id.contains("embedding") || clean_id.contains("aqa") || clean_id.contains("imagen") {
                    continue;
                }

                let display = m.get("displayName")
                    .and_then(|d| d.as_str())
                    .unwrap_or(clean_id);

                let desc = m.get("description")
                    .and_then(|d| d.as_str())
                    .unwrap_or("");

                let token_limit = m.get("inputTokenLimit")
                    .and_then(|t| t.as_u64())
                    .map(|t| {
                        if t >= 1_000_000 {
                            format!("{}M tokens", t / 1_000_000)
                        } else if t >= 1_000 {
                            format!("{}k tokens", t / 1_000)
                        } else {
                            format!("{} tokens", t)
                        }
                    })
                    .unwrap_or_else(|| "1M tokens".to_string());

                let is_thinking = clean_id.contains("thinking");
                let is_recommended = clean_id == "gemini-2.0-flash";

                results.push(DiscoveredModel {
                    id: clean_id.to_string(),
                    name: display.to_string(),
                    description: desc.to_string(),
                    context_window: token_limit,
                    supports_tools: !is_thinking,
                    supports_reasoning: is_thinking,
                    is_recommended,
                });
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
        results = get_fallback_gemini_models();
    }

    Ok(results)
}

pub async fn list_gemini_model_names(api_key: String) -> Result<Vec<String>, String> {
    let models = list_gemini_models_api(&api_key).await?;
    Ok(models.into_iter().map(|m| m.id).collect())
}

pub async fn test_gemini_connection(api_key: String, _model: Option<String>) -> Result<String, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("Gemini API key not provided".to_string());
    }

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models?key={}",
        key
    );

    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error connecting to Google Gemini API: {}", e))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("Google Gemini API returned error (Status {}): {}", status, body));
    }

    Ok("CONEXAO_OK".to_string())
}

pub async fn ask_gemini(
    api_key: String,
    model: Option<String>,
    prompt: String,
    history: Option<Vec<ChatTurn>>,
    system_instruction: Option<String>,
    enable_search: Option<bool>,
    enforcement_level: Option<String>,
) -> Result<String, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("Gemini API key not provided".to_string());
    }

    let chosen_model = model
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "gemini-2.0-flash".to_string());

    let clean_model = chosen_model.strip_prefix("models/").unwrap_or(&chosen_model);

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        clean_model, key
    );

    let client = reqwest::Client::new();
    let use_search = enable_search.unwrap_or(true);

    let mut normalized_turns: Vec<(String, String)> = Vec::new();

    if let Some(past_turns) = history {
        for turn in past_turns {
            let role = if turn.role == "user" { "user" } else { "model" };
            let clean = turn.text.trim();
            if clean.is_empty() || (clean.starts_with('{') && clean.contains("\"candidates\"")) {
                continue;
            }

            if let Some(last) = normalized_turns.last_mut() {
                if last.0 == role {
                    last.1.push_str("\n\n");
                    last.1.push_str(clean);
                } else {
                    normalized_turns.push((role.to_string(), clean.to_string()));
                }
            } else if role == "user" {
                normalized_turns.push((role.to_string(), clean.to_string()));
            }
        }
    }

    if let Some(last) = normalized_turns.last_mut() {
        if last.0 == "user" {
            last.1.push_str("\n\n");
            last.1.push_str(prompt.trim());
        } else {
            normalized_turns.push(("user".to_string(), prompt.trim().to_string()));
        }
    } else {
        normalized_turns.push(("user".to_string(), prompt.trim().to_string()));
    }

    let mut contents: Vec<serde_json::Value> = Vec::new();
    for (role, text) in normalized_turns {
        contents.push(serde_json::json!({
            "role": role,
            "parts": [{ "text": text }]
        }));
    }

    let mut payload = serde_json::json!({
        "contents": contents
    });

    if let Some(ref sys) = system_instruction {
        if !sys.trim().is_empty() {
            payload["system_instruction"] = serde_json::json!({
                "parts": [{ "text": sys.trim() }]
            });
        }
    }

    let is_thinking_model = clean_model.contains("thinking");
    if use_search && !is_thinking_model {
        payload["tools"] = serde_json::json!([{ "google_search": {} }]);
    }

    let enf = enforcement_level.unwrap_or_else(|| "medium".to_string()).to_lowercase();
    let temp = if enf == "high" { 0.1 } else if enf == "low" { 0.4 } else { 0.2 };
    let mut gen_config = serde_json::json!({
        "temperature": temp
    });
    if is_thinking_model {
        let budget = match enf.as_str() {
            "low" => 1024,
            "high" => 8192,
            _ => 4096,
        };
        gen_config["thinkingConfig"] = serde_json::json!({ "thinkingBudget": budget });
    }
    payload["generationConfig"] = gen_config;

    let res = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error connecting to Google Gemini: {}", e))?;

    let mut status = res.status();
    let mut body = res
        .text()
        .await
        .map_err(|e| format!("Error processing Gemini response: {}", e))?;

    if status == reqwest::StatusCode::NOT_FOUND && clean_model != "gemini-2.0-flash" {
        let fallback_url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
            key
        );
        if let Some(gc) = payload.get_mut("generationConfig") {
            if let Some(obj) = gc.as_object_mut() {
                obj.remove("thinkingConfig");
            }
        }
        if let Ok(fallback_res) = client
            .post(&fallback_url)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
        {
            status = fallback_res.status();
            if let Ok(fb_body) = fallback_res.text().await {
                body = fb_body;
            }
        }
    }

    let extract_text = |body_str: &str| -> Option<String> {
        let json: serde_json::Value = serde_json::from_str(body_str).ok()?;
        let candidate = json.get("candidates")?.get(0)?;
        let content = candidate.get("content")?;
        let parts = content.get("parts")?.as_array()?;

        let mut accumulated = String::new();
        for p in parts {
            if let Some(txt) = p.get("text").and_then(|t| t.as_str()) {
                accumulated.push_str(txt);
            }
        }

        if accumulated.trim().is_empty() {
            None
        } else {
            Some(accumulated)
        }
    };

    if status.is_success() {
        if let Some(text) = extract_text(&body) {
            return Ok(text);
        }
    }

    if !status.is_success() {
        return Err(format!("Google Gemini API returned error (Status {}): {}", status, body));
    }

    Err("The model completed the request without generating text output. Please retry or rephrase your prompt.".to_string())
}
