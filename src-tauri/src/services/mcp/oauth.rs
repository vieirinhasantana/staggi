use std::collections::HashMap;
use std::time::Duration;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use url::Url;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OAuthCallbackResult {
    pub success: bool,
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OAuthTokenResponse {
    pub success: bool,
    pub access_token: Option<String>,
    pub token_type: Option<String>,
    pub expires_in: Option<u64>,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OAuthDiscoveryResult {
    pub success: bool,
    pub issuer: Option<String>,
    pub authorization_endpoint: Option<String>,
    pub token_endpoint: Option<String>,
    pub registration_endpoint: Option<String>,
    pub revocation_endpoint: Option<String>,
    pub scopes_supported: Option<Vec<String>>,
    pub code_challenge_methods_supported: Option<Vec<String>>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DynamicClientRegistrationResult {
    pub success: bool,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub error: Option<String>,
}

/// Starts a temporary local loopback HTTP server to receive the OAuth 2.1 callback.
/// Automatically extracts `code` and `state`, responds to the browser with a success page,
/// and returns the parameters to Staggi.
pub async fn start_oauth_loopback(
    port: u16,
    timeout_secs: u64,
) -> Result<OAuthCallbackResult, String> {
    let addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Não foi possível iniciar o listener OAuth na porta {}: {}", port, e))?;

    let timeout_duration = Duration::from_secs(if timeout_secs == 0 { 120 } else { timeout_secs });

    let accept_future = async {
        let (mut stream, _) = listener
            .accept()
            .await
            .map_err(|e| format!("Falha ao aceitar conexão OAuth: {}", e))?;

        let mut buffer = [0u8; 4096];
        let bytes_read = stream
            .read(&mut buffer)
            .await
            .map_err(|e| format!("Falha ao ler dados da requisição OAuth: {}", e))?;

        let request = String::from_utf8_lossy(&buffer[..bytes_read]);
        let first_line = request.lines().next().unwrap_or("");
        let parts: Vec<&str> = first_line.split_whitespace().collect();

        if parts.len() < 2 || parts[0] != "GET" {
            let error_html = "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<h1>Requisição inválida</h1>";
            let _ = stream.write_all(error_html.as_bytes()).await;
            return Err("Método HTTP inválido recebido no callback".to_string());
        }

        let raw_path = parts[1];
        let parsed_url = Url::parse(&format!("http://localhost:{}{}", port, raw_path))
            .map_err(|e| format!("URL de callback inválida: {}", e))?;

        let params: HashMap<String, String> = parsed_url.query_pairs().into_owned().collect();

        let code = params.get("code").cloned();
        let state = params.get("state").cloned();
        let error = params.get("error").cloned();
        let error_description = params.get("error_description").cloned();

        let (title, message, color) = if error.is_some() {
            (
                "Falha na Autenticação",
                error_description
                    .as_deref()
                    .unwrap_or("Ocorreu um erro ao autorizar o acesso."),
                "#ef4444",
            )
        } else if code.is_some() {
            (
                "Autenticação Concluída com Sucesso",
                "O token OAuth 2.1 foi vinculado ao Staggi com segurança.<br><br>Você já pode fechar esta aba e retornar ao aplicativo.",
                "#10b981",
            )
        } else {
            (
                "Callback Incompleto",
                "Nenhum código de autorização foi encontrado no callback.",
                "#f59e0b",
            )
        };

        let response_html = format!(
            r#"<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Staggi — {title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }}
    .card {{
      background: #1e293b;
      padding: 44px 36px;
      border-radius: 18px;
      border: 1px solid #334155;
      text-align: center;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }}
    .badge {{
      display: inline-block;
      width: 52px;
      height: 52px;
      line-height: 52px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      color: {color};
      font-size: 26px;
      margin-bottom: 20px;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }}
    h1 {{
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 14px 0;
      color: #ffffff;
      letter-spacing: -0.02em;
    }}
    p {{
      font-size: 14px;
      line-height: 1.6;
      color: #94a3b8;
      margin: 0;
    }}
    .footer {{
      margin-top: 28px;
      padding-top: 18px;
      border-top: 1px solid #334155;
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">✓</div>
    <h1>{title}</h1>
    <p>{message}</p>
    <div class="footer">Staggi Wealth Management • OAuth 2.1 PKCE</div>
  </div>
</body>
</html>"#
        );

        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            response_html.as_bytes().len(),
            response_html
        );

        let _ = stream.write_all(response.as_bytes()).await;
        let _ = stream.flush().await;

        Ok(OAuthCallbackResult {
            success: code.is_some() && error.is_none(),
            code,
            state,
            error,
            error_description,
        })
    };

    match tokio::time::timeout(timeout_duration, accept_future).await {
        Ok(res) => res,
        Err(_) => Err("Tempo limite para autorização no navegador expirou (timeout).".to_string()),
    }
}

/// Exchanges an authorization code and PKCE code_verifier for OAuth 2.1 access and refresh tokens.
pub async fn exchange_oauth_code(
    token_url: String,
    client_id: String,
    client_secret: Option<String>,
    code: String,
    redirect_uri: String,
    code_verifier: String,
) -> Result<OAuthTokenResponse, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Falha ao inicializar cliente HTTP: {}", e))?;

    let mut form_params: HashMap<&str, &str> = HashMap::new();
    form_params.insert("grant_type", "authorization_code");
    form_params.insert("code", &code);
    form_params.insert("redirect_uri", &redirect_uri);
    form_params.insert("client_id", &client_id);
    form_params.insert("code_verifier", &code_verifier);

    let mut req = client
        .post(&token_url)
        .header("Accept", "application/json")
        .form(&form_params);

    if let Some(secret) = client_secret.as_ref().filter(|s| !s.trim().is_empty()) {
        req = req.basic_auth(&client_id, Some(secret.trim()));
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Falha ao enviar requisição para {}: {}", token_url, e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Falha ao ler corpo da resposta de token: {}", e))?;

    let json_val: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Resposta do servidor de token não é um JSON válido: {} (Raw: {})", e, text))?;

    if !status.is_success() {
        let err_msg = json_val
            .get("error_description")
            .and_then(|v| v.as_str())
            .or_else(|| json_val.get("error").and_then(|v| v.as_str()))
            .unwrap_or(&text);

        return Ok(OAuthTokenResponse {
            success: false,
            access_token: None,
            token_type: None,
            expires_in: None,
            refresh_token: None,
            scope: None,
            error: Some(format!("HTTP {}: {}", status.as_u16(), err_msg)),
            error_description: json_val.get("error_description").and_then(|v| v.as_str()).map(String::from),
        });
    }

    let access_token = json_val.get("access_token").and_then(|v| v.as_str()).map(String::from);
    let token_type = json_val.get("token_type").and_then(|v| v.as_str()).map(String::from);
    let expires_in = json_val.get("expires_in").and_then(|v| v.as_u64());
    let refresh_token = json_val.get("refresh_token").and_then(|v| v.as_str()).map(String::from);
    let scope = json_val.get("scope").and_then(|v| v.as_str()).map(String::from);

    Ok(OAuthTokenResponse {
        success: access_token.is_some(),
        access_token,
        token_type,
        expires_in,
        refresh_token,
        scope,
        error: None,
        error_description: None,
    })
}

/// Refreshes an expired OAuth 2.1 access token using a refresh token.
pub async fn refresh_oauth_token(
    token_url: String,
    client_id: String,
    client_secret: Option<String>,
    refresh_token: String,
) -> Result<OAuthTokenResponse, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Falha ao inicializar cliente HTTP: {}", e))?;

    let mut form_params: HashMap<&str, &str> = HashMap::new();
    form_params.insert("grant_type", "refresh_token");
    form_params.insert("refresh_token", &refresh_token);
    form_params.insert("client_id", &client_id);

    let mut req = client
        .post(&token_url)
        .header("Accept", "application/json")
        .form(&form_params);

    if let Some(secret) = client_secret.as_ref().filter(|s| !s.trim().is_empty()) {
        req = req.basic_auth(&client_id, Some(secret.trim()));
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Falha ao enviar requisição de refresh para {}: {}", token_url, e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Falha ao ler corpo da resposta de refresh: {}", e))?;

    let json_val: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Resposta de refresh não é um JSON válido: {} (Raw: {})", e, text))?;

    if !status.is_success() {
        let err_msg = json_val
            .get("error_description")
            .and_then(|v| v.as_str())
            .or_else(|| json_val.get("error").and_then(|v| v.as_str()))
            .unwrap_or(&text);

        return Ok(OAuthTokenResponse {
            success: false,
            access_token: None,
            token_type: None,
            expires_in: None,
            refresh_token: None,
            scope: None,
            error: Some(format!("HTTP {}: {}", status.as_u16(), err_msg)),
            error_description: json_val.get("error_description").and_then(|v| v.as_str()).map(String::from),
        });
    }

    let access_token = json_val.get("access_token").and_then(|v| v.as_str()).map(String::from);
    let token_type = json_val.get("token_type").and_then(|v| v.as_str()).map(String::from);
    let expires_in = json_val.get("expires_in").and_then(|v| v.as_u64());
    // Some OAuth servers rotate the refresh token; if absent, the old one remains valid
    let new_refresh_token = json_val
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .map(String::from)
        .or(Some(refresh_token));
    let scope = json_val.get("scope").and_then(|v| v.as_str()).map(String::from);

    Ok(OAuthTokenResponse {
        success: access_token.is_some(),
        access_token,
        token_type,
        expires_in,
        refresh_token: new_refresh_token,
        scope,
        error: None,
        error_description: None,
    })
}

/// Discovers OAuth 2.1 / OIDC endpoints using RFC 8414 OAuth Authorization Server Metadata
/// or OpenID Connect Discovery.
pub async fn discover_oauth_endpoints(issuer_url: String) -> Result<OAuthDiscoveryResult, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Falha ao inicializar cliente HTTP: {}", e))?;

    let trimmed = issuer_url.trim().trim_end_matches('/');

    let mut candidate_bases = vec![trimmed.to_string()];
    if let Ok(parsed) = Url::parse(trimmed) {
        let origin = parsed.origin().ascii_serialization();
        if origin != trimmed && !origin.is_empty() {
            candidate_bases.push(origin);
        }
    }

    let mut well_known_urls = Vec::new();
    for base in &candidate_bases {
        well_known_urls.push(format!("{}/.well-known/oauth-authorization-server", base));
        well_known_urls.push(format!("{}/.well-known/openid-configuration", base));
        well_known_urls.push(format!("{}/.well-known/oauth-protected-resource", base));
        well_known_urls.push(format!("{}/mcp/.well-known/oauth-authorization-server", base));
    }

    let mut last_err = String::new();

    for url in &well_known_urls {
        match client.get(url).header("Accept", "application/json").send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    if let Ok(json_val) = resp.json::<serde_json::Value>().await {
                        let issuer = json_val.get("issuer").and_then(|v| v.as_str()).map(String::from);
                        let authorization_endpoint = json_val
                            .get("authorization_endpoint")
                            .and_then(|v| v.as_str())
                            .map(String::from);
                        let token_endpoint = json_val
                            .get("token_endpoint")
                            .and_then(|v| v.as_str())
                            .map(String::from);
                        let registration_endpoint = json_val
                            .get("registration_endpoint")
                            .and_then(|v| v.as_str())
                            .map(String::from);
                        let revocation_endpoint = json_val
                            .get("revocation_endpoint")
                            .and_then(|v| v.as_str())
                            .map(String::from);
                        let scopes_supported = json_val
                            .get("scopes_supported")
                            .and_then(|v| v.as_array())
                            .map(|arr| {
                                arr.iter().filter_map(|s| s.as_str().map(String::from)).collect()
                            });
                        let code_challenge_methods_supported = json_val
                            .get("code_challenge_methods_supported")
                            .and_then(|v| v.as_array())
                            .map(|arr| {
                                arr.iter().filter_map(|s| s.as_str().map(String::from)).collect()
                            });

                        return Ok(OAuthDiscoveryResult {
                            success: true,
                            issuer,
                            authorization_endpoint,
                            token_endpoint,
                            registration_endpoint,
                            revocation_endpoint,
                            scopes_supported,
                            code_challenge_methods_supported,
                            error: None,
                        });
                    }
                } else {
                    last_err = format!("Endpoint {} retornou HTTP {}", url, resp.status().as_u16());
                }
            }
            Err(e) => {
                last_err = format!("Falha ao consultar {}: {}", url, e);
            }
        }
    }

    Ok(OAuthDiscoveryResult {
        success: false,
        issuer: None,
        authorization_endpoint: None,
        token_endpoint: None,
        registration_endpoint: None,
        revocation_endpoint: None,
        scopes_supported: None,
        code_challenge_methods_supported: None,
        error: Some(if last_err.is_empty() {
            "Não foi possível localizar os metadados de descoberta OAuth 2.1.".to_string()
        } else {
            last_err
        }),
    })
}

/// Dynamically registers an OAuth 2.1 client with the Authorization Server (RFC 7591)
pub async fn register_oauth_client(
    registration_url: String,
    client_name: String,
    redirect_uris: Vec<String>,
) -> Result<DynamicClientRegistrationResult, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| format!("Falha ao inicializar cliente HTTP: {}", e))?;

    let payload = serde_json::json!({
        "client_name": client_name,
        "redirect_uris": redirect_uris,
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none"
    });

    let resp = client
        .post(&registration_url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Falha ao contatar endpoint de registro dinâmico: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if status.is_success() {
        if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&text) {
            let client_id = json_val.get("client_id").and_then(|v| v.as_str()).map(String::from);
            let client_secret = json_val.get("client_secret").and_then(|v| v.as_str()).map(String::from);
            if client_id.is_some() {
                return Ok(DynamicClientRegistrationResult {
                    success: true,
                    client_id,
                    client_secret,
                    error: None,
                });
            }
        }
    }

    Ok(DynamicClientRegistrationResult {
        success: false,
        client_id: None,
        client_secret: None,
        error: Some(format!("Registro dinâmico retornou HTTP {}: {}", status.as_u16(), text)),
    })
}
