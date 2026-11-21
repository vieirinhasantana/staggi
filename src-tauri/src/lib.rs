use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[tauri::command]
async fn fetch_yahoo_data(symbol: String) -> Result<String, String> {
    let clean = symbol.trim().to_uppercase();
    if clean.is_empty() {
        return Err("Símbolo ou código não informado".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    // Função interna para buscar o chart de um símbolo
    async fn fetch_chart(client: &reqwest::Client, sym: &str) -> Option<String> {
        let url = format!(
            "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1d&range=5d",
            sym
        );
        if let Ok(res) = client.get(&url).send().await {
            if res.status().is_success() {
                if let Ok(text) = res.text().await {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                        if json.get("chart").and_then(|c| c.get("result")).and_then(|r| r.as_array()).is_some() {
                            return Some(text);
                        }
                    }
                }
            }
        }
        None
    }

    // Função interna para resolver ISIN, CUSIP ou termo de busca para o símbolo do Yahoo
    async fn resolve_symbol(client: &reqwest::Client, query: &str) -> Option<String> {
        let url = format!(
            "https://query1.finance.yahoo.com/v1/finance/search?q={}&quotesCount=5&newsCount=0",
            query
        );
        if let Ok(res) = client.get(&url).send().await {
            if res.status().is_success() {
                if let Ok(text) = res.text().await {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(quotes) = json.get("quotes").and_then(|q| q.as_array()) {
                            if let Some(first) = quotes.first() {
                                if let Some(sym) = first.get("symbol").and_then(|s| s.as_str()) {
                                    return Some(sym.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
        None
    }

    let is_isin = clean.len() == 12 && clean.chars().take(2).all(|c| c.is_ascii_alphabetic());
    let is_cusip = clean.len() == 9 && clean.chars().all(|c| c.is_ascii_alphanumeric());

    // Se for ISIN ou CUSIP, resolve via search primeiro
    if is_isin || is_cusip {
        if let Some(resolved) = resolve_symbol(&client, &clean).await {
            if let Some(chart_json) = fetch_chart(&client, &resolved).await {
                return Ok(chart_json);
            }
        }
    }

    // Tenta consulta direta com o símbolo informado
    if let Some(chart_json) = fetch_chart(&client, &clean).await {
        return Ok(chart_json);
    }

    // Se for ticker brasileiro (ex: PETR4, VALE3, HGLG11), tenta com sufixo .SA
    if !clean.contains('.') && (clean.ends_with('3') || clean.ends_with('4') || clean.ends_with("11") || clean.ends_with('5') || clean.ends_with('6')) {
        let sa_symbol = format!("{}.SA", clean);
        if let Some(chart_json) = fetch_chart(&client, &sa_symbol).await {
            return Ok(chart_json);
        }
    }

    // Como último recurso, busca no Yahoo Finance Search para resolver qualquer nome ou código
    if let Some(resolved) = resolve_symbol(&client, &clean).await {
        if resolved != clean {
            if let Some(chart_json) = fetch_chart(&client, &resolved).await {
                return Ok(chart_json);
            }
        }
    }

    Err(format!("Ativo não localizado no Yahoo Finance para o código '{}'", clean))
}

fn extract_xml_tag(xml: &str, tag: &str) -> Option<String> {
    let open_tag = format!("<{}>", tag);
    let close_tag = format!("</{}>", tag);
    let start = xml.find(&open_tag)? + open_tag.len();
    let end = xml[start..].find(&close_tag)?;
    let content = &xml[start..start + end];
    let unescaped = content
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'");
    Some(unescaped.trim().to_string())
}

#[tauri::command]
async fn fetch_yahoo_news(query: Option<String>) -> Result<String, String> {
    let q = query.unwrap_or_else(|| "market".to_string()).trim().to_string();
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    // Determina os símbolos a consultar no RSS feed de notícias em tempo real
    let symbols = if q.is_empty() || q.eq_ignore_ascii_case("market") || q.eq_ignore_ascii_case("noticias") || q.eq_ignore_ascii_case("mercado") {
        "%5EBVSP,BRL=X,CL=F,GC=F,%5EGSPC,%5EIXIC,PETR4.SA,VALE3.SA,ITUB4.SA,AAPL,NVDA,MSFT".to_string()
    } else {
        let mut clean_syms: Vec<String> = Vec::new();
        for raw in q.split(&[',', ' ', ';'][..]) {
            let s = raw.trim().to_uppercase();
            if s.is_empty() { continue; }
            if (s.ends_with('3') || s.ends_with('4') || s.ends_with("11") || s.ends_with('5') || s.ends_with('6')) && !s.contains('.') {
                clean_syms.push(format!("{}.SA", s));
            } else {
                clean_syms.push(s);
            }
        }
        if clean_syms.is_empty() {
            "%5EBVSP,BRL=X,CL=F,GC=F,%5EGSPC,%5EIXIC,PETR4.SA,VALE3.SA,ITUB4.SA,AAPL,NVDA,MSFT".to_string()
        } else {
            clean_syms.join(",")
        }
    };

    // 1. Tenta consulta ao feed RSS oficial do Yahoo Finance
    let rss_url = format!("https://feeds.finance.yahoo.com/rss/2.0/headline?s={}", symbols);
    if let Ok(res) = client.get(&rss_url).send().await {
        if res.status().is_success() {
            if let Ok(xml_text) = res.text().await {
                let mut news_items = Vec::new();
                for item_block in xml_text.split("<item>").skip(1) {
                    let item_content = item_block.split("</item>").next().unwrap_or("");
                    let title = extract_xml_tag(item_content, "title").unwrap_or_default();
                    let link = extract_xml_tag(item_content, "link").unwrap_or_default();
                    let pub_date = extract_xml_tag(item_content, "pubDate").unwrap_or_default();
                    let desc = extract_xml_tag(item_content, "description").unwrap_or_default();
                    let guid = extract_xml_tag(item_content, "guid").unwrap_or_default();

                    if !title.is_empty() {
                        news_items.push(serde_json::json!({
                            "uuid": if guid.is_empty() { format!("news-{}", news_items.len()) } else { guid },
                            "title": title,
                            "publisher": "Yahoo Finance News",
                            "link": link,
                            "providerPublishTime": pub_date,
                            "summary": desc
                        }));
                    }
                }

                if !news_items.is_empty() {
                    return Ok(serde_json::json!({ "news": news_items }).to_string());
                }
            }
        }
    }

    // 2. Fallback secundário via endpoint search query2
    let search_url = format!("https://query2.finance.yahoo.com/v1/finance/search?q={}&newsCount=10", q);
    if let Ok(res2) = client.get(&search_url).send().await {
        if res2.status().is_success() {
            if let Ok(json_text) = res2.text().await {
                return Ok(json_text);
            }
        }
    }

    Ok(serde_json::json!({ "news": [] }).to_string())
}

#[tauri::command]
async fn list_gemini_models(api_key: String) -> Result<Vec<String>, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("Chave da API do Gemini não informada".to_string());
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
        .map_err(|e| format!("Erro ao consultar modelos da Google Gemini API: {}", e))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("Falha ao listar modelos (Status {}): {}", status, body));
    }

    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Erro ao processar JSON de modelos: {}", e))?;

    let mut model_names = Vec::new();
    if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
        for m in models {
            let supports_generate = m.get("supportedGenerationMethods")
                .and_then(|s| s.as_array())
                .map(|arr| arr.iter().any(|v| v.as_str() == Some("generateContent")))
                .unwrap_or(false);

            if supports_generate {
                if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                    let clean = name.strip_prefix("models/").unwrap_or(name);
                    model_names.push(clean.to_string());
                }
            }
        }
    }

    if model_names.is_empty() {
        model_names = vec![
            "gemini-1.5-flash".to_string(),
            "gemini-2.0-flash".to_string(),
            "gemini-1.5-pro".to_string(),
        ];
    }

    Ok(model_names)
}

#[tauri::command]
async fn test_gemini_connection(api_key: String, _model: Option<String>) -> Result<String, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("Chave da API do Gemini não informada".to_string());
    }

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models?key={}",
        key
    );

    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .header("x-goog-api-key", key)
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| format!("Erro de rede ao conectar na Google Gemini API: {}", e))?;

    let status = res.status();
    let body = res
        .text()
        .await
        .unwrap_or_default();

    if !status.is_success() {
        return Err(format!("Google Gemini API retornou erro (Status {}): {}", status, body));
    }

    Ok("CONEXAO_OK".to_string())
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct ChatTurn {
    pub role: String,
    pub text: String,
}

#[tauri::command]
async fn ask_gemini(
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
        return Err("Chave da API do Gemini não informada".to_string());
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

    // Monta o histórico cronológico garantindo estrita alternância (user -> model -> user -> model -> user)
    let mut normalized_turns: Vec<(String, String)> = Vec::new();

    if let Some(past_turns) = history {
        for turn in past_turns {
            let role = if turn.role == "user" { "user" } else { "model" };
            let clean = turn.text.trim();
            // Ignora mensagens vazias ou mensagens de erro JSON brutas
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

    // O último turno da conversa é sempre o prompt atual do usuário
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

    // Habilita busca em tempo real na internet via Google Search Grounding (schema oficial REST: google_search)
    if use_search {
        payload["tools"] = serde_json::json!([{ "google_search": {} }]);
    }

    let enf = enforcement_level.unwrap_or_else(|| "medium".to_string()).to_lowercase();
    let temp = if enf == "high" { 0.1 } else if enf == "low" { 0.4 } else { 0.2 };
    let is_thinking_model = clean_model.contains("thinking");
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
        .header("x-goog-api-key", key)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Erro de rede ao conectar no Google Gemini: {}", e))?;

    let mut status = res.status();
    let mut body = res
        .text()
        .await
        .map_err(|e| format!("Erro ao processar resposta do Gemini: {}", e))?;

    // Se o modelo especificado não existir (404 Not Found), faz fallback transparente para gemini-2.0-flash
    let mut current_url = url;
    if status == reqwest::StatusCode::NOT_FOUND && clean_model != "gemini-2.0-flash" {
        current_url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
            key
        );
        if let Some(gc) = payload.get_mut("generationConfig") {
            if let Some(obj) = gc.as_object_mut() {
                obj.remove("thinkingConfig");
            }
        }
        if let Ok(fallback_res) = client
            .post(&current_url)
            .header("x-goog-api-key", key)
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

    // Função auxiliar para extrair o texto acumulado de todas as partes do candidate 0
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

    // 1. Tenta extrair o texto da resposta inicial
    if status.is_success() {
        if let Some(text) = extract_text(&body) {
            return Ok(text);
        }
    }

    // 2. Se falhou e use_search estava ativo, tenta com a sintaxe alternativa camelCase "googleSearch"
    if use_search {
        if let Some(obj) = payload.as_object_mut() {
            obj.insert("tools".to_string(), serde_json::json!([{ "googleSearch": {} }]));
        }
        if let Ok(res_alt) = client
            .post(&current_url)
            .header("x-goog-api-key", key)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
        {
            if res_alt.status().is_success() {
                if let Ok(body_alt) = res_alt.text().await {
                    if let Some(text_alt) = extract_text(&body_alt) {
                        return Ok(text_alt);
                    }
                }
            }
        }
        // Se ambos falharem, remove tools e tenta sem grounding
        if let Some(obj) = payload.as_object_mut() {
            obj.remove("tools");
        }
        if let Ok(res2) = client
            .post(&current_url)
            .header("x-goog-api-key", key)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
        {
            if res2.status().is_success() {
                if let Ok(body2) = res2.text().await {
                    if let Some(text2) = extract_text(&body2) {
                        return Ok(text2);
                    }
                }
            }
        }
    }

    // 3. Fallback 2: se ainda assim retornou vazio, retenta apenas com o prompt isolado do usuário
    let fallback_payload = serde_json::json!({
        "contents": [{
            "role": "user",
            "parts": [{ "text": prompt.trim() }]
        }],
        "system_instruction": payload.get("system_instruction").cloned()
    });

    if let Ok(res3) = client
        .post(&current_url)
        .header("x-goog-api-key", key)
        .header("Content-Type", "application/json")
        .json(&fallback_payload)
        .send()
        .await
    {
        if res3.status().is_success() {
            if let Ok(body3) = res3.text().await {
                if let Some(text3) = extract_text(&body3) {
                    return Ok(text3);
                }
            }
        }
    }

    if !status.is_success() {
        return Err(format!("Google Gemini API retornou erro (Status {}): {}", status, body));
    }

    // Se o Gemini retornou STOP mas sem texto legível em nenhuma tentativa
    Err("O modelo concluiu a consulta sem gerar texto de resposta. Tente reenviar ou reformular sua pergunta.".to_string())
}

#[tauri::command]
async fn test_ai_connection(
    provider: String,
    api_key: String,
    model: Option<String>,
) -> Result<String, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("Chave de API não informada".to_string());
    }

    let prov = provider.to_lowercase();
    match prov.as_str() {
        "openai" => {
            let client = reqwest::Client::new();
            // Teste de autenticação oficial via lista de modelos (zero custo de tokens e imune a saldo para geração)
            let res = client
                .get("https://api.openai.com/v1/models")
                .header("Authorization", format!("Bearer {}", key))
                .send()
                .await
                .map_err(|e| format!("Erro de rede ao conectar na OpenAI: {}", e))?;
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            if !status.is_success() {
                return Err(format!("OpenAI retornou erro (Status {}): {}", status, body));
            }
            Ok("CONEXAO_OK".to_string())
        }
        "anthropic" => {
            let client = reqwest::Client::new();
            // Tenta validação via GET /v1/models
            let res = client
                .get("https://api.anthropic.com/v1/models")
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
                .map_err(|e| format!("Erro de rede ao conectar na Anthropic: {}", e))?;
            let status = res.status();
            if status.is_success() {
                return Ok("CONEXAO_OK".to_string());
            }

            // Fallback para ping de mensagem caso GET /v1/models não esteja liberado para o tier da chave
            let chosen_model = model.filter(|m| !m.trim().is_empty()).unwrap_or_else(|| "claude-3-5-haiku-latest".to_string());
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
                .map_err(|e| format!("Erro de rede ao conectar na Anthropic: {}", e))?;
            let post_status = res_post.status();
            let post_body = res_post.text().await.unwrap_or_default();
            if !post_status.is_success() {
                return Err(format!("Anthropic retornou erro (Status {}): {}", post_status, post_body));
            }
            Ok("CONEXAO_OK".to_string())
        }
        _ => {
            test_gemini_connection(api_key, model).await
        }
    }
}

#[tauri::command]
async fn ask_ai(
    provider: Option<String>,
    api_key: String,
    model: Option<String>,
    prompt: String,
    history: Option<Vec<ChatTurn>>,
    system_instruction: Option<String>,
    enable_search: Option<bool>,
    enforcement_level: Option<String>,
) -> Result<String, String> {
    let prov = provider.unwrap_or_else(|| "gemini".to_string()).to_lowercase();
    let key = api_key.trim();
    if key.is_empty() {
        return Err(format!("Chave da API de {} não informada", prov));
    }
    let enf = enforcement_level.clone().unwrap_or_else(|| "medium".to_string()).to_lowercase();

    match prov.as_str() {
        "openai" => {
            let chosen_model = model.filter(|m| !m.trim().is_empty()).unwrap_or_else(|| "gpt-4o".to_string());
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
                // OpenAI o1 e o3-mini suportam o parâmetro reasoning_effort ("low" | "medium" | "high")
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

            let res = client.post(url)
                .header("Authorization", format!("Bearer {}", key))
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Erro de rede ao conectar na OpenAI: {}", e))?;

            let status = res.status();
            let body = res.text().await.map_err(|e| format!("Erro ao ler resposta da OpenAI: {}", e))?;
            if !status.is_success() {
                return Err(format!("OpenAI retornou erro (Status {}): {}", status, body));
            }

            let json: serde_json::Value = serde_json::from_str(&body)
                .map_err(|e| format!("Erro ao processar JSON da OpenAI: {}", e))?;
            let content = json.get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c0| c0.get("message"))
                .and_then(|m| m.get("content"))
                .and_then(|s| s.as_str())
                .unwrap_or_default();

            Ok(content.to_string())
        }
        "anthropic" => {
            let chosen_model = model.filter(|m| !m.trim().is_empty()).unwrap_or_else(|| "claude-3-7-sonnet-latest".to_string());
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
                // Claude 3.7 Sonnet suporta Extended Thinking via parâmetro thinking e budget_tokens
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

            let res = client.post(url)
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Erro de rede ao conectar na Anthropic: {}", e))?;

            let status = res.status();
            let body = res.text().await.map_err(|e| format!("Erro ao processar resposta da Anthropic: {}", e))?;
            if !status.is_success() {
                return Err(format!("Anthropic retornou erro (Status {}): {}", status, body));
            }

            let json: serde_json::Value = serde_json::from_str(&body)
                .map_err(|e| format!("Erro ao processar JSON da Anthropic: {}", e))?;
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
        _ => {
            ask_gemini(key.to_string(), model, prompt, history, system_instruction, enable_search, Some(enf)).await
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            hide_window,
            restart_app,
            fetch_yahoo_data,
            fetch_yahoo_news,
            list_gemini_models,
            test_gemini_connection,
            ask_gemini,
            test_ai_connection,
            ask_ai
        ])
        .setup(|app| {
            // Menu da Bandeja (botão direito no ícone da barra de tarefas / menu bar)
            let show_i = MenuItem::with_id(app, "toggle", "Exibir / Ocultar Staggi", true, None::<&str>)?;
            let check_updates_i = MenuItem::with_id(app, "check_updates", "Verificar e Baixar Atualização...", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Sair do Staggi", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &check_updates_i, &quit_i])?;

            // Configuração do Tray Icon (Barra de tarefas / Menu bar)
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Staggi — AI Wealth Launcher (Ctrl+Espaço)")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "toggle" => {
                        toggle_window(app);
                    }
                    "check_updates" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = window.emit("trigger-check-updates", ());
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }
                        | TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } => {
                            toggle_window(tray.app_handle());
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Registra atalho global Control+Space e CommandOrControl+Space
            for shortcut_str in ["Control+Space", "CommandOrControl+Space"] {
                if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
                    let _ = app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            toggle_window(app);
                        }
                    });
                }
            }

            // Oculta a janela ao invés de matar o app ao fechar
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
