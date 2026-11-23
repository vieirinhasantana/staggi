pub async fn fetch_yahoo_data(symbol: String) -> Result<String, String> {
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

pub async fn fetch_yahoo_news(query: Option<String>) -> Result<String, String> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_xml_tag() {
        let xml = "<item><title>PETR4 sobe 2% com petróleo</title><link>https://globo.com</link></item>";
        assert_eq!(
            extract_xml_tag(xml, "title"),
            Some("PETR4 sobe 2% com petróleo".to_string())
        );
        assert_eq!(
            extract_xml_tag(xml, "link"),
            Some("https://globo.com".to_string())
        );
        assert_eq!(extract_xml_tag(xml, "nonexistent"), None);
    }
}

