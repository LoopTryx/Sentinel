//! Redacted durable inventory. References identify records, never authorize actions.
use serde::{Deserialize, Serialize};
use ts_rs::TS;
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuarantineItem {
    pub reference: String,
    pub file_name: String,
    pub bytes: String,
    pub sha256: String,
    pub added_at: String,
    pub state: String,
    pub can_restore: bool,
    pub can_destroy: bool,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuarantineInventory {
    pub items: Vec<QuarantineItem>,
}
