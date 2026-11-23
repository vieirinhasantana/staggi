pub mod commands;
pub mod models;
pub mod services;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use commands::ai::{
    ask_ai, ask_gemini, list_ai_models, list_gemini_models, test_ai_connection,
    test_gemini_connection,
};
use commands::mcp::{call_mcp_tool, test_mcp_connection};
use commands::window::{hide_window, restart_app, toggle_window};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            hide_window,
            restart_app,
            list_gemini_models,
            list_ai_models,
            test_gemini_connection,
            ask_gemini,
            test_ai_connection,
            ask_ai,
            test_mcp_connection,
            call_mcp_tool
        ])
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "toggle", "Exibir / Ocultar Staggi", true, None::<&str>)?;
            let check_updates_i = MenuItem::with_id(app, "check_updates", "Verificar e Baixar Atualização...", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Sair do Staggi", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &check_updates_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Staggi — AI Wealth Launcher (Ctrl+Espaço)")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "toggle" => {
                        toggle_window(app);
                    }
                    "check_updates" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = window.emit("trigger-check-updates", ());
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }
                        | TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } => {
                            toggle_window(tray.app_handle());
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            for shortcut_str in ["Control+Space", "CommandOrControl+Space"] {
                if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
                    let _ = app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            toggle_window(app);
                        }
                    });
                }
            }

            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
