#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Jazz Guitar Drop Helper: the window and the saved state. Everything else, the music theory
//! included, happens in the page (src/); see docs/architecture.md.

mod settings;

use settings::{Settings, Store, Theme};
use tauri::{Manager, State, WebviewWindow};

/// The appearance and the page's saved state, read once at launch.
#[tauri::command]
fn load_state(store: State<'_, Store>) -> Settings {
    store.get()
}

/// Saves the page's own state: the progression, what's chosen, the fretboard settings.
#[tauri::command]
fn save_ui(store: State<'_, Store>, ui: serde_json::Value) -> Result<(), String> {
    store.update(|s| s.ui = ui)
}

/// Settings → Appearance. The window's theme also sets the page's `prefers-color-scheme`
/// (on Windows Tauri passes it on to WebView2), so the CSS's dark mode follows it as is.
#[tauri::command]
fn set_theme(window: WebviewWindow, store: State<'_, Store>, theme: Theme) -> Result<(), String> {
    window
        .set_theme(theme.window_theme())
        .map_err(|e| format!("Couldn't change the appearance: {e}"))?;
    store.update(|s| s.theme = theme)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let store = Store::load(&app.path().app_data_dir()?);
            let theme = store.get().theme;
            app.manage(store);
            // The window is created here, not from tauri.conf.json ("create": false), so it starts
            // in the chosen theme: a theme set on a window that already exists misses its title bar.
            let config = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .ok_or("No main window in tauri.conf.json")?;
            let window = tauri::WebviewWindowBuilder::from_config(app.handle(), config)?.theme(theme.window_theme());
            // The page draws its own title bar, so the app's name appears once, in the sidebar
            // (docs/ui.md#title-bar). On Windows the window has no system title bar and the page
            // also draws the window buttons; Tauri keeps resizing at the edges.
            #[cfg(windows)]
            let window = window.decorations(false);
            // On macOS the system's buttons stay, over the sidebar above its brand, centered 26 px
            // down on the toolbar's first row: AppKit centers them 2 px above the inset. The title
            // bar is see-through, with its title hidden, and clicks under it reach the page. The
            // page's drag areas need the first click on an inactive window to reach the page.
            #[cfg(target_os = "macos")]
            let window = window
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true)
                .traffic_light_position(tauri::LogicalPosition::new(18.0, 28.0))
                .accept_first_mouse(true);
            window.build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![load_state, save_ui, set_theme])
        .run(tauri::generate_context!())
        .expect("error while running Jazz Guitar Drop Helper");
}
