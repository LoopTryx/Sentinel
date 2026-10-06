//! SENTINEL local antivirus core.
//!
//! Ported verbatim from the owner's `cyber-shield` desktop build (the working
//! 5-layer engine) so the main repository's desktop app can run it natively.
//! Pure library: no Tauri, no IPC — the desktop shell (`apps/desktop-tauri`)
//! owns the command layer and calls into these modules.

pub mod db;
pub mod engine;
pub mod vault;

#[cfg(test)]
mod tests;
