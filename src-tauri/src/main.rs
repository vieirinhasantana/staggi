// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "windows")]
    {
        // Enforce GPU hardware acceleration and prevent Chromium occlusion/throttling
        // on Windows transparent/borderless windows, eliminating severe UI stutter and lag.
        if std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").is_err() {
            // Safety: Called before spawning threads or initializing WebView2
            unsafe {
                std::env::set_var(
                    "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
                    "--enable-gpu-rasterization --enable-zero-copy --disable-features=CalculateNativeWinOcclusion --disable-background-timer-throttling",
                );
            }
        }
    }

    staggi_lib::run()
}
