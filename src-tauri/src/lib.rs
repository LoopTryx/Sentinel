mod db;
mod engine;
#[cfg(test)]
mod tests;
mod vault;

// The Tauri shell (and with it the WebView2 loader DLL) is only wired for
// the real binary. Keeping it out of the lib's test build means `cargo
// test` produces a test exe that loads without WebView2 — the engine and
// vault tests never touch it.
#[cfg(not(test))]
mod commands;

#[cfg(not(test))]
use commands::AppState;
#[cfg(not(test))]
use std::sync::Mutex;
#[cfg(not(test))]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(not(test))]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            let conn = db::init(&app_data)?;
            db::load_extra_signatures(&conn, &app_data);
            let vault = vault::Vault::new(&app_data);
            app.manage(db::Db(Mutex::new(conn)));
            app.manage(AppState {
                engine: engine::Engine::new(),
                vault,
                app_data,
            });
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
        .expect("error while running tauri application");
}
