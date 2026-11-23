use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiscoveredModel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub context_window: String,
    pub supports_tools: bool,
    pub supports_reasoning: bool,
    pub is_recommended: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatTurn {
    pub role: String,
    pub text: String,
}
