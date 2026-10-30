//! SENTINEL local antivirus core.
//!
//! Ported verbatim from the owner's `cyber-shield` desktop build (the working
//! 5-layer engine) so the main repository's desktop app can run it natively.
//! Pure library: no Tauri, no IPC â€” the desktop shell (`apps/desktop-tauri`)
//! owns the command layer and calls into these modules.

pub mod db;
pub mod engine;
mod file_subject;
pub use file_subject::InspectedSubject;
pub mod inspection;
pub mod inspection_wire;
pub mod official_signatures;
#[cfg(windows)]
pub mod protection;
pub mod quarantine_journal;
pub mod scan_jobs;
mod storage_path;
mod storage_privacy;
pub mod vault;

#[cfg(test)]
mod tests;

#[cfg(all(test, windows))]
mod inspected_quarantine_tests;

#[cfg(windows)]
mod retained_map;
