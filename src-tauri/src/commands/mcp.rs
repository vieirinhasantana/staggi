use crate::models::mcp::McpTestResult;
use crate::services::mcp;

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
