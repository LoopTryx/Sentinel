use serde::Serialize;
use ts_rs::TS;

// Output-only local synthetic-demo DTOs; no plaintext password or native authority.
#[derive(Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct DemoState {
    pub revision: u32,
    pub mode: String,
    pub connected: bool,
    pub unlocked: bool,
    pub extension_id: String,
    pub accounts: Vec<DemoAccount>,
    pub events: Vec<DemoEvent>,
    pub scan: Option<DemoScan>,
}
#[derive(Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct DemoAccount {
    pub id: String,
    pub name: String,
    pub user: String,
    pub host: String,
    pub health: String,
    pub reasons: Vec<String>,
    pub reused: bool,
}
#[derive(Serialize, TS)]
#[ts(export)]
pub struct DemoEvent {
    pub id: String,
    pub at: String,
    pub source: String,
    pub kind: String,
    pub codes: Vec<String>,
}
#[derive(Serialize, TS)]
#[ts(export)]
pub struct DemoScan {
    pub id: String,
    pub status: String,
    pub coverage: String,
    pub engine: String,
    pub visited: u32,
    pub checked: u32,
    pub skipped: u32,
    pub errors: u32,
    pub bytes: u32,
    pub files: Vec<DemoFile>,
    pub findings: Vec<DemoFinding>,
}
#[derive(Serialize, TS)]
#[ts(export)]
pub struct DemoFile {
    pub name: String,
    pub sha256: String,
    pub bytes: u32,
}
#[derive(Serialize, TS)]
#[ts(export)]
pub struct DemoFinding {
    pub name: String,
    pub kind: String,
    pub reason: String,
    pub sha256: String,
}
