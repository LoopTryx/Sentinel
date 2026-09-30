use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum Risk {
    NoneObserved,
    Info,
    Suspicious,
    High,
    Unknown,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum Confidence {
    Low,
    Medium,
    High,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum Coverage {
    Complete,
    Partial,
    Unavailable,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum CheckState {
    Pass,
    Finding,
    Skipped,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Check {
    pub id: String,
    pub state: CheckState,
    pub reason_key: String,
    pub evidence_refs: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Reason {
    pub code: String,
    pub message_key: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Action {
    pub id: String,
    pub requires_admin: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Assessment {
    pub id: String,
    pub subject_ref: String,
    pub risk: Risk,
    pub confidence: Confidence,
    pub coverage: Coverage,
    pub checks: Vec<Check>,
    pub reasons: Vec<Reason>,
    pub actions: Vec<Action>,
    pub engine_versions: BTreeMap<String, String>,
    pub observed_at: String,
    pub expires_at: Option<String>,
    pub lesson_ids: Vec<String>,
}

impl Assessment {
    pub fn unknown(subject_ref: &str, observed_at: &str) -> Self {
        Self {
            id: format!("assessment:{subject_ref}"),
            subject_ref: subject_ref.to_owned(),
            risk: Risk::Unknown,
            confidence: Confidence::Low,
            coverage: Coverage::Unavailable,
            checks: vec![Check {
                id: "availability".to_owned(),
                state: CheckState::Skipped,
                reason_key: "assessment.check.unavailable".to_owned(),
                evidence_refs: vec![],
            }],
            reasons: vec![Reason {
                code: "not_assessed".to_owned(),
                message_key: "assessment.reason.not_assessed".to_owned(),
            }],
            actions: vec![Action {
                id: "review_capabilities".to_owned(),
                requires_admin: false,
            }],
            engine_versions: BTreeMap::new(),
            observed_at: observed_at.to_owned(),
            expires_at: None,
            lesson_ids: vec![],
        }
    }
}
