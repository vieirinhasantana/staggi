use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

fn get_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn resolve_downloads_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .download_dir()
        .or_else(|_| {
            std::env::var("HOME")
                .map(|h| PathBuf::from(h).join("Downloads"))
                .map_err(|e| tauri::Error::from(std::io::Error::new(std::io::ErrorKind::NotFound, e)))
        })
        .or_else(|_| {
            std::env::var("USERPROFILE")
                .map(|u| PathBuf::from(u).join("Downloads"))
                .map_err(|e| tauri::Error::from(std::io::Error::new(std::io::ErrorKind::NotFound, e)))
        })
        .unwrap_or_else(|_| std::env::temp_dir())
}

#[tauri::command]
pub async fn save_and_open_pdf_report(
    app: tauri::AppHandle,
    filename: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let download_dir = resolve_downloads_dir(&app);

    if !download_dir.exists() {
        let _ = std::fs::create_dir_all(&download_dir);
    }

    let safe_filename = if filename.trim().is_empty() {
        format!("Staggi_Report_{}.pdf", get_timestamp())
    } else {
        let mut clean = filename.trim().to_string();
        if !clean.to_lowercase().ends_with(".pdf") {
            clean.push_str(".pdf");
        }
        clean.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_")
    };

    let target_path = download_dir.join(&safe_filename);

    std::fs::write(&target_path, &bytes)
        .map_err(|e| format!("Failed to save PDF report to {}: {}", target_path.display(), e))?;

    let path_str = target_path.to_string_lossy().to_string();

    // Opens PDF file with system default viewer (Preview on macOS, Edge/Adobe on Windows)
    let _ = tauri_plugin_opener::open_path(&path_str, None::<&str>);

    // Reveals item in Finder / File Explorer
    let _ = tauri_plugin_opener::reveal_item_in_dir(&path_str);

    Ok(path_str)
}

#[tauri::command]
pub async fn save_and_open_html_report(
    app: tauri::AppHandle,
    filename: String,
    html_content: String,
) -> Result<String, String> {
    let download_dir = resolve_downloads_dir(&app);

    if !download_dir.exists() {
        let _ = std::fs::create_dir_all(&download_dir);
    }

    let safe_filename = if filename.trim().is_empty() {
        format!("Staggi_Report_{}.html", get_timestamp())
    } else {
        let mut clean = filename.trim().to_string();
        if !clean.to_lowercase().ends_with(".html") {
            clean.push_str(".html");
        }
        clean.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_")
    };

    let target_path = download_dir.join(&safe_filename);

    std::fs::write(&target_path, html_content.as_bytes())
        .map_err(|e| format!("Failed to save HTML report: {}", e))?;

    let path_str = target_path.to_string_lossy().to_string();

    let _ = tauri_plugin_opener::open_path(&path_str, None::<&str>);

    Ok(path_str)
}
