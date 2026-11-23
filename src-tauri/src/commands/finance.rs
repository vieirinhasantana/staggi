use crate::services::finance::yahoo;

#[tauri::command]
pub async fn fetch_yahoo_data(symbol: String) -> Result<String, String> {
    yahoo::fetch_yahoo_data(symbol).await
}

#[tauri::command]
pub async fn fetch_yahoo_news(query: Option<String>) -> Result<String, String> {
    yahoo::fetch_yahoo_news(query).await
}
