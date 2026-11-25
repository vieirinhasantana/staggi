pub mod anthropic;
pub mod bedrock;
pub mod gemini;
pub mod openai;

use crate::models::ai::{AIModel, ChatTurn};

pub async fn list_ai_models(
    provider: String,
    api_key: String,
) -> Result<Vec<AIModel>, String> {
    let prov = provider.to_lowercase();
    let key = api_key.trim();

    if key.is_empty() {
        return Err("API key or credentials not provided".to_string());
    }

    match prov.as_str() {
        "gemini" => gemini::list_gemini_models_api(key).await,
        "openai" => openai::list_openai_models_api(key).await,
        "anthropic" => anthropic::list_anthropic_models_api(key).await,
        "bedrock" => bedrock::list_bedrock_models_api(key).await,
        _ => Err(format!("Unsupported AI provider: {}", provider)),
    }
}

pub async fn test_ai_connection(
    provider: String,
    api_key: String,
    model: Option<String>,
) -> Result<String, String> {
    let prov = provider.to_lowercase();
    let key = api_key.trim();

    if key.is_empty() {
        return Err("API key or credentials not provided".to_string());
    }

    match prov.as_str() {
        "openai" => openai::test_openai_connection(key).await,
        "anthropic" => anthropic::test_anthropic_connection(key, model).await,
        "bedrock" => bedrock::test_bedrock_connection(key).await,
        _ => gemini::test_gemini_connection(api_key, model).await,
    }
}

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
    let prov = provider.unwrap_or_else(|| "gemini".to_string()).to_lowercase();
    let key = api_key.trim();

    if key.is_empty() {
        return Err(format!("Credentials for {} not provided", prov));
    }

    match prov.as_str() {
        "openai" => {
            openai::ask_openai(key, model, &prompt, history, system_instruction, enforcement_level)
                .await
        }
        "anthropic" => {
            anthropic::ask_anthropic(
                key,
                model,
                &prompt,
                history,
                system_instruction,
                enforcement_level,
            )
            .await
        }
        "bedrock" => {
            bedrock::ask_bedrock(
                key,
                model,
                &prompt,
                history,
                system_instruction,
                enforcement_level,
            )
            .await
        }
        _ => {
            gemini::ask_gemini(
                key.to_string(),
                model,
                prompt,
                history,
                system_instruction,
                enable_search,
                enforcement_level,
            )
            .await
        }
    }
}
