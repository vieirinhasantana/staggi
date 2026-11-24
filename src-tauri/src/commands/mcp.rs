use crate::models::mcp::McpTestResult;
use crate::services::mcp;
use crate::services::mcp::oauth::{OAuthCallbackResult, OAuthDiscoveryResult, OAuthTokenResponse};

#[tauri::command]
pub async fn test_mcp_connection(
    endpoint: String,
    transport: String,
    api_key: Option<String>,
    auth_header: Option<String>,
) -> Result<McpTestResult, String> {
    mcp::test_mcp_connection(endpoint, transport, api_key, auth_header).await
}

#[tauri::command]
pub async fn call_mcp_tool(
    endpoint: String,
    transport: String,
    tool_name: String,
    arguments: Option<serde_json::Value>,
    api_key: Option<String>,
    auth_header: Option<String>,
) -> Result<serde_json::Value, String> {
    mcp::call_mcp_tool(endpoint, transport, tool_name, arguments, api_key, auth_header).await
}

#[tauri::command]
pub async fn mcp_start_oauth_loopback(
    port: u16,
    timeout_secs: Option<u64>,
) -> Result<OAuthCallbackResult, String> {
    mcp::start_oauth_loopback(port, timeout_secs.unwrap_or(120)).await
}

#[tauri::command]
pub async fn mcp_exchange_oauth_code(
    token_url: String,
    client_id: String,
    client_secret: Option<String>,
    code: String,
    redirect_uri: String,
    code_verifier: String,
) -> Result<OAuthTokenResponse, String> {
    mcp::exchange_oauth_code(
        token_url,
        client_id,
        client_secret,
        code,
        redirect_uri,
        code_verifier,
    )
    .await
}

#[tauri::command]
pub async fn mcp_refresh_oauth_token(
    token_url: String,
    client_id: String,
    client_secret: Option<String>,
    refresh_token: String,
) -> Result<OAuthTokenResponse, String> {
    mcp::refresh_oauth_token(token_url, client_id, client_secret, refresh_token).await
}

#[tauri::command]
pub async fn mcp_discover_oauth_endpoints(
    issuer_url: String,
) -> Result<OAuthDiscoveryResult, String> {
    mcp::discover_oauth_endpoints(issuer_url).await
}
