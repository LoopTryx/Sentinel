use serde::Serialize;
use ts_rs::TS;

/// Output-only evidence computed by the local runtime. Never contains provider credentials.
#[derive(Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct AiFinding {
    pub r#ref: String,
    pub source: String,
    pub detected_at: String,
    pub url: String,
    pub assessment: String,
    pub signals: Vec<AiSignal>,
    pub limitation: String,
}

#[derive(Serialize, TS)]
#[ts(export)]
pub struct AiSignal {
    pub code: String,
    pub text: String,
}

/// Model interpretation, not a new detector result or an action authorization.
#[derive(Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct AiAnswer {
    pub evidence_refs: Vec<String>,
    pub explanation: String,
    pub uncertainty: String,
    pub recommendations: Vec<String>,
}
