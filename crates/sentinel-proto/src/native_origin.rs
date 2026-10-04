//! Closed installed-origin configuration. This is not OS caller authentication.

const MAX_ORIGINS: usize = 4;
const PREFIX: &str = "chrome-extension://";
const ORIGIN_LENGTH: usize = PREFIX.len() + 32 + 1;

#[derive(Debug, PartialEq, Eq)]
pub enum OriginConfigError {
    Empty,
    TooMany,
    InvalidId,
    DuplicateId,
}

pub struct NativeOriginAllowlist {
    origins: Vec<String>,
}

impl std::fmt::Debug for NativeOriginAllowlist {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeOriginAllowlist")
            .field("registered_origin_count", &self.origins.len())
            .finish()
    }
}

impl NativeOriginAllowlist {
    /// Consumes trusted installed IDs, not page data or the claimed caller origin.
    /// A malformed entry rejects the whole configuration; no wildcard fallback.
    pub fn new(ids: Vec<String>) -> Result<Self, OriginConfigError> {
        if ids.is_empty() {
            return Err(OriginConfigError::Empty);
        }
        if ids.len() > MAX_ORIGINS {
            return Err(OriginConfigError::TooMany);
        }
        let mut origins = Vec::with_capacity(ids.len());
        for id in ids {
            if id.len() != 32 || !id.bytes().all(|byte| (b'a'..=b'p').contains(&byte)) {
                return Err(OriginConfigError::InvalidId);
            }
            let origin = format!("{PREFIX}{id}/");
            if origins.contains(&origin) {
                return Err(OriginConfigError::DuplicateId);
            }
            origins.push(origin);
        }
        Ok(Self { origins })
    }

    /// Byte-exact canonical origin comparison, without decoding or normalization.
    /// A positive result never grants SID/session identity or request authority.
    pub fn allows(&self, claimed_origin: &str) -> bool {
        claimed_origin.len() == ORIGIN_LENGTH
            && self.origins.iter().any(|origin| origin == claimed_origin)
    }
}
