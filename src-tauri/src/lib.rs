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

    if is_isin || is_cusip {
        if let Some(resolved) = resolve_symbol(&client, &clean).await {
            if let Some(chart_json) = fetch_chart(&client, &resolved).await {
                return Ok(chart_json);
            }
        }
    }

    if let Some(chart_json) = fetch_chart(&client, &clean).await {
        return Ok(chart_json);
    }

    if !clean.contains('.') && (clean.ends_with('3') || clean.ends_with('4') || clean.ends_with("11") || clean.ends_with('5') || clean.ends_with('6')) {
        let sa_symbol = format!("{}.SA", clean);
        if let Some(chart_json) = fetch_chart(&client, &sa_symbol).await {
            return Ok(chart_json);
        }
    }

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

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct DiscoveredModel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub context_window: String,
    pub supports_tools: bool,
    pub supports_reasoning: bool,
    pub is_recommended: bool,
}

fn get_fallback_gemini_models() -> Vec<DiscoveredModel> {
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
        DiscoveredModel {
            id: "gemini-1.5-flash-8b".to_string(),
            name: "Gemini 1.5 Flash-8B".to_string(),
            description: "Compact high-frequency analytical model".to_string(),
            context_window: "1M tokens".to_string(),
            supports_tools: true,
            supports_reasoning: false,
            is_recommended: false,
        },
    ]
}

fn get_fallback_openai_models() -> Vec<DiscoveredModel> {
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

fn get_fallback_anthropic_models() -> Vec<DiscoveredModel> {
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

#[tauri::command]
async fn list_ai_models(
    provider: String,
    api_key: String,
) -> Result<Vec<DiscoveredModel>, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("API key not provided".to_string());
    }

    let prov = provider.to_lowercase();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    match prov.as_str() {
        "gemini" => {
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
        "openai" => {
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
                            } else if id_lower.contains("4o") || id_lower.contains("gpt-4.5") {
                                "128k tokens"
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
        "anthropic" => {
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
                                        let display = m.get("display_name")
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
                                            }.to_string(),
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
        _ => Err(format!("Unsupported AI provider: {}", provider)),
    }
}

#[tauri::command]
async fn list_gemini_models(api_key: String) -> Result<Vec<String>, String> {
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
        .map_err(|e| format!("Error querying Google Gemini API models: {}", e))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("Failed to list Gemini models (Status {}): {}", status, body));
    }

    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Error parsing Gemini models response: {}", e))?;

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
            "gemini-2.0-flash".to_string(),
            "gemini-2.0-flash-lite".to_string(),
            "gemini-1.5-flash".to_string(),
            "gemini-1.5-pro".to_string(),
        ];
    }

    Ok(model_names)
}

#[tauri::command]
async fn test_gemini_connection(api_key: String, _model: Option<String>) -> Result<String, String> {
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
    let body = res
        .text()
        .await
        .unwrap_or_default();

    if !status.is_success() {
        return Err(format!("Google Gemini API returned error (Status {}): {}", status, body));
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

    if use_search {
        if let Some(obj) = payload.as_object_mut() {
            obj.insert("tools".to_string(), serde_json::json!([{ "googleSearch": {} }]));
        }
        if let Ok(res_alt) = client
            .post(&current_url)
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
        if let Some(obj) = payload.as_object_mut() {
            obj.remove("tools");
        }
        if let Ok(res2) = client
            .post(&current_url)
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

    let fallback_payload = serde_json::json!({
        "contents": [{
            "role": "user",
            "parts": [{ "text": prompt.trim() }]
        }],
        "system_instruction": payload.get("system_instruction").cloned()
    });

    if let Ok(res3) = client
        .post(&current_url)
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
        return Err(format!("Google Gemini API returned error (Status {}): {}", status, body));
    }

    Err("The model completed the request without generating text output. Please retry or rephrase your prompt.".to_string())
}

#[tauri::command]
async fn test_ai_connection(
    provider: String,
    api_key: String,
    model: Option<String>,
) -> Result<String, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("API key not provided".to_string());
    }

    let prov = provider.to_lowercase();
    match prov.as_str() {
        "openai" => {
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
        "anthropic" => {
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
                .map_err(|e| format!("Network error connecting to Anthropic: {}", e))?;
            let post_status = res_post.status();
            let post_body = res_post.text().await.unwrap_or_default();
            if !post_status.is_success() {
                return Err(format!("Anthropic returned error (Status {}): {}", post_status, post_body));
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
        return Err(format!("API key for {} not provided", prov));
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
                .map_err(|e| format!("Network error connecting to OpenAI: {}", e))?;

            let status = res.status();
            let body = res.text().await.map_err(|e| format!("Error reading OpenAI response: {}", e))?;
            if !status.is_success() {
                return Err(format!("OpenAI returned error (Status {}): {}", status, body));
            }

            let json: serde_json::Value = serde_json::from_str(&body)
                .map_err(|e| format!("Error parsing OpenAI JSON response: {}", e))?;
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
                .map_err(|e| format!("Network error connecting to Anthropic: {}", e))?;

            let status = res.status();
            let body = res.text().await.map_err(|e| format!("Error processing Anthropic response: {}", e))?;
            if !status.is_success() {
                return Err(format!("Anthropic returned error (Status {}): {}", status, body));
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
            list_ai_models,
            test_gemini_connection,
            ask_gemini,
            test_ai_connection,
            ask_ai
        ])
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "toggle", "Exibir / Ocultar Staggi", true, None::<&str>)?;
            let check_updates_i = MenuItem::with_id(app, "check_updates", "Verificar e Baixar Atualização...", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Sair do Staggi", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &check_updates_i, &quit_i])?;

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

            for shortcut_str in ["Control+Space", "CommandOrControl+Space"] {
                if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
                    let _ = app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            toggle_window(app);
                        }
                    });
                }
            }

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
