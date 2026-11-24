use tauri::Manager;

pub fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
pub fn hide_window(window: tauri::WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
pub fn set_content_protected(window: tauri::WebviewWindow, protected: bool) -> Result<(), String> {
    window.set_content_protected(protected).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn restart_app(app: tauri::AppHandle) {
    app.restart();
}
