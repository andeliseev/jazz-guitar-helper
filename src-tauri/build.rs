fn main() {
    // tauri-build embeds icons/icon.ico in the .exe (the taskbar's and the window's icon), but
    // watches only tauri.conf.json and capabilities/: without this, a new icon (scripts/icons.mjs)
    // wouldn't reach the app until a clean build.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::build()
}
