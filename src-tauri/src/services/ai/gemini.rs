use crate::models::ai::{AIModel, ChatTurn};

pub async fn list_gemini_models_api(key: &str) -> Result<Vec<AIModel>, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models?key={}",
        key
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

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
            let supports_generate = m
                .get("supportedGenerationMethods")
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

                let display = m
                    .get("displayName")
                    .and_then(|d| d.as_str())
                    .unwrap_or(clean_id);

                let desc = m
                    .get("description")
                    .and_then(|d| d.as_str())
                    .map(|s| s.to_string());

                results.push(AIModel {
                    id: clean_id.to_string(),
                    name: display.to_string(),
                    description: desc,
                });
            }
        }
    }

    Ok(results)
}

pub async fn list_gemini_model_names(api_key: String) -> Result<Vec<String>, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("Gemini API key not provided".to_string());
    }

    let models = list_gemini_models_api(key).await?;
    Ok(models.into_iter().map(|m| m.id).collect())
}

pub async fn test_gemini_connection(api_key: String, _model: Option<String>) -> Result<String, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("Chave API do Gemini não fornecida".to_string());
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
        .map_err(|e| format!("Erro de rede ao conectar no Gemini: {}", e))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();

    if status.is_success() {
        return Ok("CONEXAO_OK".to_string());
    }

    if status == reqwest::StatusCode::BAD_REQUEST || status == reqwest::StatusCode::FORBIDDEN {
        return Err(format!("Chave de API inválida ou sem permissão (Status {}): {}", status, body));
    }

    Err(format!("Falha na validação da API Gemini (Status {}): {}", status, body))
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
        return Err("Chave API do Gemini não fornecida".to_string());
    }

    let raw_model = model.unwrap_or_else(|| "gemini-2.0-flash".to_string());
    let clean_model = raw_model.trim().strip_prefix("models/").unwrap_or(raw_model.trim());
    let clean_model = if clean_model.is_empty() {
        "gemini-2.0-flash"
    } else {
        clean_model
    };

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        clean_model, key
    );

    let client = reqwest::Client::new();
    let mut contents: Vec<serde_json::Value> = Vec::new();

    if let Some(past_turns) = history {
        for turn in past_turns {
            let role = if turn.role == "user" { "user" } else { "model" };
            let clean_text = turn.text.trim();
            if !clean_text.is_empty() && !(clean_text.starts_with('{') && clean_text.contains("\"candidates\"")) {
                contents.push(serde_json::json!({
                    "role": role,
                    "parts": [{ "text": clean_text }]
                }));
            }
        }
    }

    contents.push(serde_json::json!({
        "role": "user",
        "parts": [{ "text": prompt.trim() }]
    }));

    let mut payload = serde_json::json!({
        "contents": contents
    });

    let enf = enforcement_level.unwrap_or_else(|| "medium".to_string()).to_lowercase();
    let temperature = match enf.as_str() {
        "low" => 0.4,
        "high" => 0.1,
        _ => 0.2,
    };

    let mut gen_config = serde_json::json!({
        "temperature": temperature
    });

    if clean_model.contains("thinking") {
        gen_config["thinkingConfig"] = serde_json::json!({
            "thinkingBudget": 1024
        });
    }

    payload["generationConfig"] = gen_config;

    let search_allowed = !clean_model.contains("thinking") && enable_search.unwrap_or(true);
    if search_allowed {
        payload["tools"] = serde_json::json!([
            { "googleSearch": {} }
        ]);
    }

    if let Some(sys) = system_instruction {
        if !sys.trim().is_empty() {
            payload["systemInstruction"] = serde_json::json!({
                "parts": [{ "text": sys.trim() }]
            });
        }
    }

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
        let candidates = json.get("candidates")?.as_array()?;
        let first = candidates.first()?;
        let content = first.get("content")?;
        let parts = content.get("parts")?.as_array()?;
        let mut full_text = String::new();
        for part in parts {
            if let Some(t) = part.get("text").and_then(|v| v.as_str()) {
                full_text.push_str(t);
            }
        }
        if full_text.trim().is_empty() {
            None
        } else {
            Some(full_text)
        }
    };

    if let Some(text) = extract_text(&body) {
        return Ok(text);
    }

    if !status.is_success() {
        return Err(format!("Google Gemini API returned error (Status {}): {}", status, body));
    }

    Err("The model completed the request without generating text output. Please retry or rephrase your prompt.".to_string())
}
