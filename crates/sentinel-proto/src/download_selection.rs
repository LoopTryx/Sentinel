//! Correlation-only download observation. This never grants filesystem access.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DownloadObservation {
    pub session_ref: String,
    pub download_ref: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct InvalidDownloadObservation;

impl DownloadObservation {
    /// Required after decoding and before retaining correlation. Authentication
    /// and completion/selection authority remain separate trusted native gates.
    pub fn validate(&self) -> Result<(), InvalidDownloadObservation> {
        for reference in [&self.session_ref, &self.download_ref] {
            if reference.is_empty()
                || reference.len() > 64
                || !reference
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            {
                return Err(InvalidDownloadObservation);
            }
        }
        Ok(())
    }
}
