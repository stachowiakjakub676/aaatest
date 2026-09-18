//! Clapeyron desktop shell.
//!
//! The shell only hosts the web client. Chemistry runs either inside the page (RDKit
//! WebAssembly) or in the optional Python API, which can be shipped as a sidecar binary
//! (see docs/PACKAGING.md) and started from here with tauri-plugin-shell.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running Clapeyron");
}
