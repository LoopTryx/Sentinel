// SENTINEL console — native shell over the apps/ui bundle and the
// sentinel-av engine (ported from the owner's cyber-shield build).
// Presentation shell + command adapter only: detection, vault and DB logic
// live in the sentinel-av crate.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use sentinel_av::db;
use std::sync::Mutex;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            let conn = db::init(&app_data)?;
            db::load_extra_signatures(&conn, &app_data);
            let vault = sentinel_av::vault::Vault::new(&app_data);
            app.manage(db::Db(Mutex::new(conn)));
            app.manage(commands::AppState {
                engine: sentinel_av::engine::Engine::new(),
                vault,
                app_data,
            });
            // The window is built in code with an explicit WebviewUrl: the
            // config-driven window in this shell stayed on about:blank (the
            // URL was present in the baked context but never navigated).
            // Creating it here navigates reliably on Windows/GNU builds.
            let _window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("index.html".into()),
            )
            .title("SENTINEL — Think. Protect. Defend.")
            .inner_size(1360.0, 900.0)
            .min_inner_size(960.0, 640.0)
            .resizable(true)
            .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_path,
            commands::simulate_attack,
            commands::list_recent_threats,
            commands::list_quarantine,
            commands::restore_quarantine,
            commands::destroy_quarantine,
            commands::list_drives,
            commands::app_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Sentinel console");
}
