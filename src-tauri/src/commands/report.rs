use flate2::read::ZlibDecoder;
use std::io::Read;
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
pub async fn extract_pdf_text(bytes: Vec<u8>) -> Result<String, String> {
    let mut extracted_lines = Vec::new();

    let stream_marker = b"stream";
    let endstream_marker = b"endstream";

    let mut cursor = 0;
    while cursor < bytes.len() {
        if let Some(stream_pos) = bytes[cursor..].windows(stream_marker.len()).position(|w| w == stream_marker) {
            let start = cursor + stream_pos + stream_marker.len();
            let mut stream_start = start;
            if stream_start < bytes.len() && (bytes[stream_start] == b'\r' || bytes[stream_start] == b'\n') {
                if bytes[stream_start] == b'\r' && stream_start + 1 < bytes.len() && bytes[stream_start + 1] == b'\n' {
                    stream_start += 2;
                } else {
                    stream_start += 1;
                }
            }

            if let Some(end_pos) = bytes[stream_start..].windows(endstream_marker.len()).position(|w| w == endstream_marker) {
                let stream_bytes = &bytes[stream_start..stream_start + end_pos];

                let mut decompressed = Vec::new();
                let mut decoder = ZlibDecoder::new(stream_bytes);
                let decompressed_text = if decoder.read_to_end(&mut decompressed).is_ok() && !decompressed.is_empty() {
                    String::from_utf8_lossy(&decompressed).to_string()
                } else {
                    String::from_utf8_lossy(stream_bytes).to_string()
                };

                parse_pdf_bt_text(&decompressed_text, &mut extracted_lines);

                cursor = stream_start + end_pos + endstream_marker.len();
            } else {
                break;
            }
        } else {
            break;
        }
    }

    if extracted_lines.is_empty() {
        let raw = String::from_utf8_lossy(&bytes);
        parse_pdf_bt_text(&raw, &mut extracted_lines);
    }

    let result = extracted_lines.join("\n").trim().to_string();
    if result.is_empty() {
        Ok("Document parsed. No text layer found (scanned image document).".to_string())
    } else {
        Ok(result)
    }
}

fn parse_pdf_bt_text(content: &str, output: &mut Vec<String>) {
    let mut in_bt = false;
    let mut current_line = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "BT" || trimmed.starts_with("BT ") {
            in_bt = true;
            current_line.clear();
            continue;
        }
        if trimmed == "ET" || trimmed.starts_with("ET ") {
            in_bt = false;
            if !current_line.is_empty() {
                output.push(current_line.join(" "));
                current_line.clear();
            }
            continue;
        }

        if in_bt {
            if let Some(tj_pos) = trimmed.find("Tj") {
                let before = trimmed[..tj_pos].trim();
                if let (Some(start), Some(end)) = (before.rfind('('), before.rfind(')')) {
                    if start < end {
                        let text = clean_pdf_string(&before[start + 1..end]);
                        if !text.is_empty() {
                            current_line.push(text);
                        }
                    }
                }
            } else if let Some(tj_pos) = trimmed.find("TJ") {
                let before = trimmed[..tj_pos].trim();
                let mut parts = Vec::new();
                let mut in_paren = false;
                let mut cur_part = String::new();
                let mut escape = false;

                for ch in before.chars() {
                    if escape {
                        cur_part.push(ch);
                        escape = false;
                    } else if ch == '\\' {
                        escape = true;
                    } else if ch == '(' && !in_paren {
                        in_paren = true;
                        cur_part.clear();
                    } else if ch == ')' && in_paren {
                        in_paren = false;
                        parts.push(clean_pdf_string(&cur_part));
                    } else if in_paren {
                        cur_part.push(ch);
                    }
                }
                if !parts.is_empty() {
                    current_line.push(parts.join(""));
                }
            }
        }
    }

    if !current_line.is_empty() {
        output.push(current_line.join(" "));
    }
}

fn clean_pdf_string(s: &str) -> String {
    let mut res = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            if let Some(next) = chars.next() {
                match next {
                    'n' => res.push('\n'),
                    'r' => res.push('\r'),
                    't' => res.push('\t'),
                    '(' => res.push('('),
                    ')' => res.push(')'),
                    '\\' => res.push('\\'),
                    '0'..='7' => {
                        let mut oct = String::new();
                        oct.push(next);
                        for _ in 0..2 {
                            if let Some(&ch) = chars.peek() {
                                if ('0'..='7').contains(&ch) {
                                    oct.push(chars.next().unwrap());
                                } else {
                                    break;
                                }
                            }
                        }
                        if let Ok(val) = u8::from_str_radix(&oct, 8) {
                            res.push(val as char);
                        }
                    }
                    _ => res.push(next),
                }
            }
        } else {
            res.push(c);
        }
    }
    res
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
