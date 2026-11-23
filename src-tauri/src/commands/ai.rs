use crate::models::ai::{AIModel, ChatTurn};
use crate::services::ai;

#[tauri::command]
pub async fn list_gemini_models(api_key: String) -> Result<Vec<String>, String> {
    ai::gemini::list_gemini_model_names(api_key).await
}

#[tauri::command]
pub async fn list_ai_models(
    provider: String,
    api_key: String,
) -> Result<Vec<AIModel>, String> {
    ai::list_ai_models(provider, api_key).await
}

#[tauri::command]
pub async fn test_gemini_connection(
    api_key: String,
    model: Option<String>,
) -> Result<String, String> {
    ai::gemini::test_gemini_connection(api_key, model).await
}

#[tauri::command]
pub async fn ask_gemini(
    api_key: String,
    model: Option<String>,
    prompt: String,
    history: Option<Vec<ChatTurn>>,
    system_instruction: Option<String>,
    enable_search: Option<bool>,
    enforcement_level: Option<String>,
) -> Result<String, String> {
    ai::gemini::ask_gemini(
        api_key,
        model,
        prompt,
        history,
        system_instruction,
        enable_search,
        enforcement_level,
    )
    .await
}

#[tauri::command]
pub async fn test_ai_connection(
    provider: String,
    api_key: String,
    model: Option<String>,
) -> Result<String, String> {
    ai::test_ai_connection(provider, api_key, model).await
}

#[tauri::command]
pub async fn ask_ai(
    provider: Option<String>,
    api_key: String,
    model: Option<String>,
    prompt: String,
    history: Option<Vec<ChatTurn>>,
    system_instruction: Option<String>,
    enable_search: Option<bool>,
    enforcement_level: Option<String>,
) -> Result<String, String> {
    ai::ask_ai(
        provider,
        api_key,
        model,
        prompt,
        history,
        system_instruction,
        enable_search,
        enforcement_level,
    )
    .await
}
