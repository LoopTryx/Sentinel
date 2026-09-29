use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolVersion {
    pub major: u16,
    pub minor: u16,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProtocolError {
    MajorMismatch,
}

impl ProtocolVersion {
    pub const fn new(major: u16, minor: u16) -> Self {
        Self { major, minor }
    }

    pub fn negotiate(self, peer: Self) -> Result<Self, ProtocolError> {
        if self.major != peer.major {
            return Err(ProtocolError::MajorMismatch);
        }
        Ok(Self::new(self.major, self.minor.min(peer.minor)))
    }
}
