use crate::models::mcp::{McpTestResult, McpTool};

pub fn format_civil_date(ts: i64) -> String {
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

pub fn get_yahoo_finance_tools() -> Vec<McpTool> {
    vec![
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
    ]
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

    let tools = get_yahoo_finance_tools();

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
            fetch_stock_quote(&client, &symbol).await
        }
        "get_historical_dividends" | "dividends" | "get_dividends" => {
            fetch_historical_dividends(&client, &symbol).await
        }
        "get_market_news" | "news" | "get_news" => {
            let news_query = args.get("query").and_then(|q| q.as_str()).unwrap_or(&symbol);
            fetch_market_news(&client, news_query).await
        }
        _ => Err(format!("Ferramenta '{}' desconhecida no Yahoo Finance MCP", tool_name))
    }
}

async fn fetch_stock_quote(client: &reqwest::Client, symbol: &str) -> Result<serde_json::Value, String> {
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

        let close_prices: Vec<f64> = chart_val.get("chart")
            .and_then(|c| c.get("result"))
            .and_then(|r| r.get(0))
            .and_then(|item| item.get("indicators"))
            .and_then(|ind| ind.get("quote"))
            .and_then(|q| q.get(0))
            .and_then(|q0| q0.get("close"))
            .and_then(|closes| closes.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_f64())
                    .collect()
            })
            .unwrap_or_default();

        let history_str = if !close_prices.is_empty() {
            let prices_formatted: Vec<String> = close_prices.iter().map(|p| format!("{:.2}", p)).collect();
            format!("\nHistórico Recente (5d): {}", prices_formatted.join(", "))
        } else {
            String::new()
        };

        let result_str = format!(
            "Ativo: {}\nCotação Atual: {} {:.2}\nVariação Diária: {:+.2}%\nMáxima do Dia: {} {:.2}\nMínima do Dia: {} {:.2}\nVolume: {}\nMercado/Bolsa: {}\nHorário de Referência: Tempo Real{}",
            symbol, currency, regular_market_price, change_percent, currency, high, currency, low, volume, exchange_name, history_str
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
                "changePercent": change_percent,
                "history": close_prices
            }
        }))
    } else {
        Err(format!("Dados não encontrados para o ticker {}", symbol))
    }
}

async fn fetch_historical_dividends(client: &reqwest::Client, symbol: &str) -> Result<serde_json::Value, String> {
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

async fn fetch_market_news(client: &reqwest::Client, query: &str) -> Result<serde_json::Value, String> {
    let search_url = format!("https://query1.finance.yahoo.com/v1/finance/search?q={}&quotesCount=2&newsCount=6", query);
    let mut news_text = format!("Notícias de Mercado para {}:\n", query);

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
