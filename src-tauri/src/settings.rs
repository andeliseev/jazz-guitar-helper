//! `settings.json` in the app data folder: the appearance, and the page's own state (the
//! progression and what's chosen), which Rust keeps without looking inside.

use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

impl Theme {
    /// None follows the system.
    pub fn window_theme(self) -> Option<tauri::Theme> {
        match self {
            Theme::System => None,
            Theme::Light => Some(tauri::Theme::Light),
            Theme::Dark => Some(tauri::Theme::Dark),
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub theme: Theme,
    /// The page's state as it last sent it; null until then, and the page starts with its defaults.
    #[serde(default)]
    pub ui: serde_json::Value,
}

pub struct Store {
    path: PathBuf,
    settings: Mutex<Settings>,
}

impl Store {
    /// Reads `settings.json` in `dir`. A missing or unreadable file gives the defaults.
    pub fn load(dir: &Path) -> Self {
        let path = dir.join("settings.json");
        let settings = fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default();
        Store { path, settings: Mutex::new(settings) }
    }

    pub fn get(&self) -> Settings {
        self.lock().clone()
    }

    /// Changes the settings and saves them.
    pub fn update(&self, change: impl FnOnce(&mut Settings)) -> Result<(), String> {
        let mut settings = self.lock();
        change(&mut settings);
        let text = serde_json::to_string_pretty(&*settings).map_err(|e| e.to_string())?;
        write_file(&self.path, &text).map_err(|e| format!("Couldn't save your settings: {e}"))
    }

    // A panic while the lock was held leaves plain data behind, still fine to use.
    fn lock(&self) -> MutexGuard<'_, Settings> {
        self.settings.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// Writes a temp file first, then renames it over the old one, so a crash can't leave half a file.
fn write_file(path: &Path, text: &str) -> io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, text)?;
    fs::rename(&temp, path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("drop-helper-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn starts_with_defaults_without_a_file() {
        let store = Store::load(&temp_dir("missing"));
        let settings = store.get();
        assert_eq!(settings.theme, Theme::System);
        assert!(settings.ui.is_null());
    }

    #[test]
    fn saves_and_reads_back() {
        let dir = temp_dir("round-trip");
        let store = Store::load(&dir);
        store.update(|s| s.theme = Theme::Dark).unwrap();
        store.update(|s| s.ui = json!({ "drop": "drop3", "chords": [] })).unwrap();
        let again = Store::load(&dir).get();
        assert_eq!(again.theme, Theme::Dark);
        assert_eq!(again.ui["drop"], "drop3");
        assert!(!dir.join("settings.json.tmp").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_broken_file_gives_the_defaults() {
        let dir = temp_dir("broken");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("settings.json"), "{ not json").unwrap();
        assert_eq!(Store::load(&dir).get().theme, Theme::System);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_fields_get_defaults() {
        let settings: Settings = serde_json::from_str(r#"{ "theme": "light" }"#).unwrap();
        assert_eq!(settings.theme, Theme::Light);
        assert!(settings.ui.is_null());
    }
}
