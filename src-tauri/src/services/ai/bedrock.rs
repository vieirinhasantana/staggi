use crate::models::ai::{AIModel, ChatTurn};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone)]
pub struct BedrockCredentials {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub region: String,
    pub session_token: Option<String>,
}

/// Parses the packed Bedrock credentials string.
/// Formats supported:
/// 1. JSON: `{"accessKeyId": "...", "secretAccessKey": "...", "region": "...", "sessionToken": "..."}`
/// 2. Delimited: `access_key_id###secret_access_key###region(optional, default us-east-1)###session_token(optional)`
pub fn parse_bedrock_credentials(raw: &str) -> Result<BedrockCredentials, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Credenciais da AWS para o Amazon Bedrock não fornecidas.".to_string());
    }

    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) {
            let access_key = v.get("accessKeyId")
                .or_else(|| v.get("access_key_id"))
                .or_else(|| v.get("accessKey"))
                .and_then(|s| s.as_str())
                .unwrap_or("")
                .trim();
            let secret_key = v.get("secretAccessKey")
                .or_else(|| v.get("secret_access_key"))
                .or_else(|| v.get("secretKey"))
                .and_then(|s| s.as_str())
                .unwrap_or("")
                .trim();
            let region = v.get("region")
                .and_then(|s| s.as_str())
                .unwrap_or("us-east-1")
                .trim();
            let session_token = v.get("sessionToken")
                .or_else(|| v.get("session_token"))
                .and_then(|s| s.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());

            if access_key.is_empty() || secret_key.is_empty() {
                return Err("AWS Access Key ID ou Secret Access Key ausente no JSON de credenciais.".to_string());
            }

            return Ok(BedrockCredentials {
                access_key_id: access_key.to_string(),
                secret_access_key: secret_key.to_string(),
                region: if region.is_empty() { "us-east-1".to_string() } else { region.to_string() },
                session_token,
            });
        }
    }

    let parts: Vec<&str> = trimmed.split("###").map(|p| p.trim()).collect();
    if parts.len() < 2 {
        return Err("Formato de credenciais inválido. Use AccessKey###SecretKey###Região ou forneça um objeto JSON com accessKeyId e secretAccessKey.".to_string());
    }

    let access_key = parts[0];
    let secret_key = parts[1];
    let region = if parts.len() > 2 && !parts[2].is_empty() { parts[2] } else { "us-east-1" };
    let session_token = if parts.len() > 3 && !parts[3].is_empty() { Some(parts[3].to_string()) } else { None };

    if access_key.is_empty() || secret_key.is_empty() {
        return Err("AWS Access Key ID e Secret Access Key são obrigatórios.".to_string());
    }

    Ok(BedrockCredentials {
        access_key_id: access_key.to_string(),
        secret_access_key: secret_key.to_string(),
        region: region.to_string(),
        session_token,
    })
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC can take key of any size");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn get_signature_key(key: &str, date_stamp: &str, region_name: &str, service_name: &str) -> Vec<u8> {
    let k_secret = format!("AWS4{}", key);
    let k_date = hmac_sha256(k_secret.as_bytes(), date_stamp.as_bytes());
    let k_region = hmac_sha256(&k_date, region_name.as_bytes());
    let k_service = hmac_sha256(&k_region, service_name.as_bytes());
    hmac_sha256(&k_service, b"aws4_request")
}

/// Signs an HTTP request using AWS Signature Version 4 (SigV4)
fn sign_request(
    method: &str,
    uri: &str,
    service: &str,
    creds: &BedrockCredentials,
    payload: &[u8],
    amz_date: &str,
    date_stamp: &str,
    host: &str,
) -> HashMap<String, String> {
    let payload_hash = sha256_hex(payload);

    let mut headers_to_sign = vec![
        ("content-type".to_string(), "application/json".to_string()),
        ("host".to_string(), host.to_string()),
        ("x-amz-date".to_string(), amz_date.to_string()),
    ];

    if let Some(ref token) = creds.session_token {
        headers_to_sign.push(("x-amz-security-token".to_string(), token.clone()));
    }

    headers_to_sign.sort_by(|a, b| a.0.cmp(&b.0));

    let canonical_headers = headers_to_sign
        .iter()
        .map(|(k, v)| format!("{}:{}\n", k, v.trim()))
        .collect::<Vec<_>>()
        .join("");

    let signed_headers = headers_to_sign
        .iter()
        .map(|(k, _)| k.as_str())
        .collect::<Vec<_>>()
        .join(";");

    let canonical_request = format!(
        "{}\n{}\n\n{}\n{}\n{}",
        method, uri, canonical_headers, signed_headers, payload_hash
    );

    let credential_scope = format!("{}/{}/{}/aws4_request", date_stamp, creds.region, service);
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{}\n{}\n{}",
        amz_date,
        credential_scope,
        sha256_hex(canonical_request.as_bytes())
    );

    let signing_key = get_signature_key(&creds.secret_access_key, date_stamp, &creds.region, service);
    let signature = hex::encode(hmac_sha256(&signing_key, string_to_sign.as_bytes()));

    let authorization_header = format!(
        "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
        creds.access_key_id, credential_scope, signed_headers, signature
    );

    let mut out = HashMap::new();
    out.insert("Authorization".to_string(), authorization_header);
    out.insert("x-amz-date".to_string(), amz_date.to_string());
    out.insert("content-type".to_string(), "application/json".to_string());
    if let Some(ref token) = creds.session_token {
        out.insert("x-amz-security-token".to_string(), token.clone());
    }
    out
}

fn get_current_amz_dates() -> (String, String) {
    let now = std::time::SystemTime::now();
    let dur = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = dur.as_secs() as i64;

    // Civil date calculation
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let mins = (time_of_day % 3600) / 60;
    let sec = time_of_day % 60;

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

    let date_stamp = format!("{:04}{:02}{:02}", y, m, d);
    let amz_date = format!("{:04}{:02}{:02}T{:02}{:02}{:02}Z", y, m, d, hours, mins, sec);
    (amz_date, date_stamp)
}

/// Resolves a requested model ID to the mandatory AWS Bedrock Cross-Region Inference Profile
/// when required by AWS Bedrock for on-demand invocations (e.g. `us.anthropic.claude-3-5-sonnet-20241022-v2:0`).
pub fn resolve_inference_profile_id(model_id: &str, region: &str) -> String {
    let trimmed = model_id.trim();

    // If it's already an inference profile ID (starts with us., eu., apc., global. or an arn:)
    if trimmed.starts_with("us.")
        || trimmed.starts_with("eu.")
        || trimmed.starts_with("apc.")
        || trimmed.starts_with("global.")
        || trimmed.starts_with("arn:aws:bedrock:")
    {
        return trimmed.to_string();
    }

    // Determine geographic prefix based on the AWS region
    let prefix = if region.starts_with("eu-") {
        "eu."
    } else if region.starts_with("ap-") {
        "apc."
    } else {
        // Default to US cross-region profile (works for us-east-1, us-west-2, sa-east-1, etc.)
        "us."
    };

    // Models that AWS Bedrock requires an inference profile for on-demand invocation
    if trimmed.contains("claude-3-5-sonnet")
        || trimmed.contains("claude-3-5-haiku")
        || trimmed.contains("claude-3-7-sonnet")
        || trimmed.contains("claude-3-opus")
        || trimmed.contains("claude-3-haiku")
        || trimmed.contains("llama3-3-70b")
        || trimmed.contains("llama3-2")
        || trimmed.contains("llama3-1")
    {
        return format!("{}{}", prefix, trimmed);
    }

    trimmed.to_string()
}

pub fn get_default_bedrock_models() -> Vec<AIModel> {
    vec![
        AIModel {
            id: "us.anthropic.claude-3-5-sonnet-20241022-v2:0".to_string(),
            name: "Claude 3.5 Sonnet v2 (Inference Profile)".to_string(),
            description: Some("Anthropic Claude 3.5 Sonnet v2 via Bedrock US Profile".to_string()),
        },
        AIModel {
            id: "us.anthropic.claude-3-5-haiku-20241022-v1:0".to_string(),
            name: "Claude 3.5 Haiku (Inference Profile)".to_string(),
            description: Some("High-speed, cost-effective reasoning via US Profile".to_string()),
        },
        AIModel {
            id: "us.anthropic.claude-3-7-sonnet-20250219-v1:0".to_string(),
            name: "Claude 3.7 Sonnet (Inference Profile)".to_string(),
            description: Some("Anthropic Claude 3.7 Hybrid Reasoning via US Profile".to_string()),
        },
        AIModel {
            id: "us.meta.llama3-3-70b-instruct-v1:0".to_string(),
            name: "Llama 3.3 70B (Inference Profile)".to_string(),
            description: Some("Meta Llama 3.3 70B via Bedrock US Profile".to_string()),
        },
        AIModel {
            id: "amazon.nova-pro-v1:0".to_string(),
            name: "Amazon Nova Pro".to_string(),
            description: Some("High-capability multimodal model by AWS".to_string()),
        },
        AIModel {
            id: "amazon.nova-lite-v1:0".to_string(),
            name: "Amazon Nova Lite".to_string(),
            description: Some("Fast, ultra-affordable multimodal model by AWS".to_string()),
        },
    ]
}

pub async fn list_bedrock_models_api(credentials_raw: &str) -> Result<Vec<AIModel>, String> {
    let creds = parse_bedrock_credentials(credentials_raw)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let host = format!("bedrock.{}.amazonaws.com", creds.region);
    let (amz_date, date_stamp) = get_current_amz_dates();

    let mut discovered_models = Vec::new();

    // 1. First, query Cross-Region Inference Profiles (/inference-profiles)
    let inf_uri = "/inference-profiles?typeEquals=SYSTEM_DEFINED";
    let inf_url = format!("https://{}{}", host, inf_uri);
    let inf_headers = sign_request("GET", inf_uri, "bedrock", &creds, b"", &amz_date, &date_stamp, &host);

    let mut req_inf = client.get(&inf_url);
    for (k, v) in inf_headers {
        req_inf = req_inf.header(k, v);
    }

    if let Ok(res_inf) = req_inf.send().await {
        if res_inf.status().is_success() {
            if let Ok(json) = res_inf.json::<serde_json::Value>().await {
                if let Some(arr) = json.get("inferenceProfileSummaries").and_then(|m| m.as_array()) {
                    for p in arr {
                        let id = p.get("inferenceProfileId").and_then(|s| s.as_str()).unwrap_or("");
                        let name = p.get("inferenceProfileName").and_then(|s| s.as_str()).unwrap_or(id);
                        let status = p.get("status").and_then(|s| s.as_str()).unwrap_or("ACTIVE");

                        if status == "ACTIVE" && !id.is_empty() {
                            // Focus on Claude, Llama, and text models
                            let is_relevant = id.contains("claude") || id.contains("llama") || id.contains("nova");
                            if is_relevant {
                                discovered_models.push(AIModel {
                                    id: id.to_string(),
                                    name: format!("{} [Inference Profile]", name),
                                    description: Some(format!("Bedrock Cross-Region Profile • {}", id)),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Query Foundation Models (/foundation-models)
    let fm_uri = "/foundation-models";
    let fm_url = format!("https://{}{}", host, fm_uri);
    let fm_headers = sign_request("GET", fm_uri, "bedrock", &creds, b"", &amz_date, &date_stamp, &host);

    let mut req_fm = client.get(&fm_url);
    for (k, v) in fm_headers {
        req_fm = req_fm.header(k, v);
    }

    if let Ok(res_fm) = req_fm.send().await {
        if res_fm.status().is_success() {
            if let Ok(json) = res_fm.json::<serde_json::Value>().await {
                if let Some(arr) = json.get("modelSummaries").and_then(|m| m.as_array()) {
                    for m in arr {
                        let raw_id = m.get("modelId").and_then(|s| s.as_str()).unwrap_or("");
                        let name = m.get("modelName").and_then(|s| s.as_str()).unwrap_or(raw_id);
                        let provider = m.get("providerName").and_then(|s| s.as_str()).unwrap_or("AWS Bedrock");

                        let modalities = m.get("outputModalities").and_then(|o| o.as_array());
                        let is_text = modalities.map_or(true, |mods| {
                            mods.iter().any(|v| v.as_str() == Some("TEXT"))
                        });

                        if is_text && !raw_id.is_empty() {
                            // Resolve to inference profile id automatically if needed
                            let resolved_id = resolve_inference_profile_id(raw_id, &creds.region);
                            let already_in = discovered_models.iter().any(|existing| existing.id == resolved_id);
                            if !already_in {
                                discovered_models.push(AIModel {
                                    id: resolved_id,
                                    name: format!("{} ({})", name, provider),
                                    description: Some(format!("Amazon Bedrock • {}", provider)),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    if !discovered_models.is_empty() {
        return Ok(discovered_models);
    }

    Ok(get_default_bedrock_models())
}

pub async fn test_bedrock_connection(credentials_raw: &str) -> Result<String, String> {
    let creds = parse_bedrock_credentials(credentials_raw)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let host = format!("bedrock.{}.amazonaws.com", creds.region);
    let uri = "/foundation-models";
    let url = format!("https://{}{}", host, uri);

    let (amz_date, date_stamp) = get_current_amz_dates();
    let headers = sign_request("GET", uri, "bedrock", &creds, b"", &amz_date, &date_stamp, &host);

    let mut req = client.get(&url);
    for (k, v) in headers {
        req = req.header(k, v);
    }

    let res = req.send().await.map_err(|e| format!("Falha ao conectar com o endpoint AWS Bedrock: {}", e))?;
    let status = res.status();
    if status.is_success() {
        Ok(format!("Conexão com Amazon Bedrock (região {}) validada com sucesso!", creds.region))
    } else {
        let err_body = res.text().await.unwrap_or_default();
        Err(format!("Amazon Bedrock retornou HTTP {}: {}", status.as_u16(), err_body))
    }
}

pub async fn ask_bedrock(
    credentials_raw: &str,
    model: Option<String>,
    prompt: &str,
    history: Option<Vec<ChatTurn>>,
    system_instruction: Option<String>,
    _enforcement_level: Option<String>,
) -> Result<String, String> {
    let creds = parse_bedrock_credentials(credentials_raw)?;
    let raw_model_id = model.unwrap_or_else(|| "us.anthropic.claude-3-5-sonnet-20241022-v2:0".to_string());
    // Auto-resolve bare model IDs (e.g. anthropic.claude-3-5-sonnet...) into valid Inference Profile IDs
    let model_id = resolve_inference_profile_id(&raw_model_id, &creds.region);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;

    let host = format!("bedrock-runtime.{}.amazonaws.com", creds.region);
    let uri = format!("/model/{}/invoke", model_id);
    let url = format!("https://{}{}", host, uri);

    // Format body based on model type
    let body_bytes: Vec<u8> = if model_id.contains("anthropic") {
        let mut messages = Vec::new();
        if let Some(hist) = history {
            for turn in hist {
                messages.push(serde_json::json!({
                    "role": turn.role,
                    "content": turn.text
                }));
            }
        }
        messages.push(serde_json::json!({
            "role": "user",
            "content": prompt
        }));

        let mut payload = serde_json::json!({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "messages": messages
        });

        if let Some(sys) = system_instruction {
            if !sys.trim().is_empty() {
                payload["system"] = serde_json::Value::String(sys);
            }
        }
        serde_json::to_vec(&payload).map_err(|e| e.to_string())?
    } else if model_id.contains("amazon.nova") {
        let mut messages = Vec::new();
        if let Some(hist) = history {
            for turn in hist {
                messages.push(serde_json::json!({
                    "role": turn.role,
                    "content": [{"text": turn.text}]
                }));
            }
        }
        messages.push(serde_json::json!({
            "role": "user",
            "content": [{"text": prompt}]
        }));

        let mut payload = serde_json::json!({
            "messages": messages,
            "inferenceConfig": {
                "max_new_tokens": 4096
            }
        });
        if let Some(sys) = system_instruction {
            if !sys.trim().is_empty() {
                payload["system"] = serde_json::json!([{"text": sys}]);
            }
        }
        serde_json::to_vec(&payload).map_err(|e| e.to_string())?
    } else {
        // Generic / Llama model on Bedrock
        let formatted_prompt = if let Some(sys) = system_instruction {
            format!("<system>\n{}\n</system>\n\nUser: {}\nAssistant:", sys, prompt)
        } else {
            format!("User: {}\nAssistant:", prompt)
        };
        let payload = serde_json::json!({
            "prompt": formatted_prompt,
            "max_gen_len": 2048,
            "temperature": 0.5
        });
        serde_json::to_vec(&payload).map_err(|e| e.to_string())?
    };

    let (amz_date, date_stamp) = get_current_amz_dates();
    let headers = sign_request("POST", &uri, "bedrock", &creds, &body_bytes, &amz_date, &date_stamp, &host);

    let mut req = client.post(&url);
    for (k, v) in headers {
        req = req.header(k, v);
    }
    req = req.body(body_bytes);

    let res = req.send().await.map_err(|e| format!("Falha ao invocar modelo no Bedrock: {}", e))?;
    let status = res.status();
    let raw_text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("Amazon Bedrock retornou erro (HTTP {}): {}", status.as_u16(), raw_text));
    }

    let val: serde_json::Value = serde_json::from_str(&raw_text)
        .map_err(|e| format!("Erro ao parsear resposta do Bedrock: {} (Corpo: {})", e, raw_text))?;

    // Anthropic response extraction
    if let Some(content_arr) = val.get("content").and_then(|c| c.as_array()) {
        let texts: Vec<String> = content_arr
            .iter()
            .filter_map(|item| item.get("text").and_then(|t| t.as_str()).map(String::from))
            .collect();
        if !texts.is_empty() {
            return Ok(texts.join("\n"));
        }
    }

    // Amazon Nova response extraction
    if let Some(nova_text) = val.pointer("/output/message/content/0/text").and_then(|s| s.as_str()) {
        return Ok(nova_text.to_string());
    }

    // Meta Llama response extraction
    if let Some(gen_text) = val.get("generation").and_then(|g| g.as_str()) {
        return Ok(gen_text.to_string());
    }

    // Fallback: search for output or completion
    if let Some(comp) = val.get("completion").and_then(|c| c.as_str()) {
        return Ok(comp.to_string());
    }

    Ok(raw_text)
}
