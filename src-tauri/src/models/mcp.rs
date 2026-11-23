use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct McpTool {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_schema: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct McpTestResult {
    pub success: bool,
    pub status: String,
    pub status_code: Option<u16>,
    pub message: String,
    pub latency_ms: Option<u64>,
    pub tools: Vec<McpTool>,
}
