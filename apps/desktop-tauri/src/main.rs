// Sentinel console presentation shell (GLM, issue #10/S1).
// Native window over the built apps/ui bundle. No privileged logic or
// backend authority lives here: the future live adapter (Codex LOGIC-01)
// will surface state through contracts, not through this shell.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the Sentinel console");
}
