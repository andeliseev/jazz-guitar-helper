//! Updates from GitHub Releases, as in Unified Mail (docs/development.md#updates): the page asks for
//! a newer version, and installs it when the user clicks Update in Settings.

use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

/// The newer release `check_update` found, kept for `install_update`.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

/// Asks the release site (`plugins.updater.endpoints`) for a newer version. Returns that version,
/// or null when this one is the newest.
#[tauri::command]
pub async fn check_update(app: AppHandle, pending: State<'_, PendingUpdate>) -> Result<Option<String>, String> {
    let fail = |e: tauri_plugin_updater::Error| format!("Couldn't check for updates: {e}");
    let update = app.updater().map_err(fail)?.check().await.map_err(fail)?;
    let version = update.as_ref().map(|u| u.version.clone());
    *pending.0.lock().unwrap_or_else(|e| e.into_inner()) = update;
    Ok(version)
}

/// Downloads the update `check_update` found, checks its signature against
/// `plugins.updater.pubkey` and installs it. On Windows the app exits here and the installer starts
/// it again. On macOS it quits and is opened again once it's gone, so it comes back under its own
/// Dock icon (`relaunch_after_exit`); elsewhere it restarts itself.
#[tauri::command]
pub async fn install_update(app: AppHandle, pending: State<'_, PendingUpdate>) -> Result<(), String> {
    let update = pending.0.lock().unwrap_or_else(|e| e.into_inner()).take();
    let update = update.ok_or("There's no update to install. Open Settings again to check.")?;
    let fail = |e: tauri_plugin_updater::Error| format!("Couldn't install the update: {e}");
    let bytes = update.download(|_, _| {}, || {}).await.map_err(fail)?;
    update.install(&bytes).map_err(fail)?;
    #[cfg(target_os = "macos")]
    if mac::relaunch_after_exit() {
        app.exit(0);
        return Ok(());
    }
    app.restart()
}

#[cfg(target_os = "macos")]
mod mac {
    use std::ffi::OsStr;
    use std::os::unix::process::CommandExt;
    use std::path::Path;
    use std::process::{Child, Command, Stdio};

    /// After an update: opens the app again once this copy has quit, as a click on its Dock icon
    /// would. Tauri's restart runs `open -n` while this copy still runs, and the Dock gives that
    /// second copy a second icon; a kept-in-Dock icon then looks closed. False when not running
    /// from an app bundle (`npm run dev`). The same as Unified Mail's.
    pub fn relaunch_after_exit() -> bool {
        let Ok(exe) = tauri::utils::platform::current_exe() else { return false };
        let Some(bundle) = app_bundle(&exe) else { return false };
        run_after_exit(std::process::id(), &["/usr/bin/open".as_ref(), bundle.as_os_str()]).is_ok()
    }

    /// `X.app` for `X.app/Contents/MacOS/binary`.
    fn app_bundle(exe: &Path) -> Option<&Path> {
        let macos = exe.parent()?;
        let contents = macos.parent()?;
        let bundle = contents.parent()?;
        let named = |dir: &Path, name: &str| dir.file_name().is_some_and(|n| n == name);
        let is_app = bundle.extension().is_some_and(|e| e == "app");
        (named(macos, "MacOS") && named(contents, "Contents") && is_app).then_some(bundle)
    }

    /// Waits for process `$1` to end, checking every 0.1 s, then runs the other arguments.
    /// LaunchServices lists an app a few ms longer than it runs, and an `open` in between only
    /// tries to bring the gone copy forward, so it also waits until `lsappinfo` no longer finds it.
    /// Gives up after a minute: a copy that hasn't quit by then shouldn't get a second one next to it.
    const AFTER_EXIT: &str = r#"pid=$1; shift; i=0
while kill -0 "$pid" 2>/dev/null || /usr/bin/lsappinfo find pid="$pid" | grep -q ASN; do
  [ "$i" -lt 600 ] || exit 1
  sleep 0.1; i=$((i + 1))
done
exec "$@""#;

    /// Runs `command` once process `pid` has ended. The shell gets its own process group and no
    /// stdio, so it outlives the app.
    fn run_after_exit(pid: u32, command: &[&OsStr]) -> std::io::Result<Child> {
        Command::new("/bin/sh")
            .args(["-c", AFTER_EXIT, "sh"])
            .arg(pid.to_string())
            .args(command)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .process_group(0)
            .spawn()
    }
}
