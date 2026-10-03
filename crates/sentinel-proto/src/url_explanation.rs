use crate::assessment::{Confidence, Coverage, Risk};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum UrlReason {
    EmbeddedCredentials,
    UnencryptedHttp,
    IpLiteral,
    InternationalizedHost,
    UnusualPort,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum UrlExplanationError {
    TooLong,
    AmbiguousInput,
    UnsupportedScheme,
    InvalidUrl,
}

/// A local syntax explanation, not a reputation or browser enforcement result.
/// Raw input, userinfo, path, query and fragment are deliberately absent.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct UrlExplanation {
    pub schema_version: u16,
    pub host_ascii: String,
    pub scheme: String,
    pub port: u16,
    pub registrable_domain: Option<String>,
    pub risk: Risk,
    pub confidence: Confidence,
    pub coverage: Coverage,
    pub reasons: Vec<UrlReason>,
    pub network_accessed: bool,
    pub reputation_checked: bool,
}
