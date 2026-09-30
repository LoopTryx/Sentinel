use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use url::Url;

pub const MAX_FEED_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_URL_BYTES: usize = 2_048;
pub const MAX_ENTRIES: usize = 100_000;
const MAX_TTL_SECONDS: u64 = 24 * 60 * 60;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FeedError {
    Oversized,
    InvalidUtf8,
    InvalidUrl,
    InvalidExpiry,
    Empty,
    TooManyEntries,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UrlhausFeed {
    pub provider: String,
    pub retrieved_at: u64,
    pub expires_at: u64,
    pub urls: Vec<String>,
}

impl UrlhausFeed {
    pub fn parse(bytes: &[u8], retrieved_at: u64, ttl_seconds: u64) -> Result<Self, FeedError> {
        if bytes.len() > MAX_FEED_BYTES {
            return Err(FeedError::Oversized);
        }
        if ttl_seconds == 0 || ttl_seconds > MAX_TTL_SECONDS {
            return Err(FeedError::InvalidExpiry);
        }
        let expires_at = retrieved_at
            .checked_add(ttl_seconds)
            .ok_or(FeedError::InvalidExpiry)?;
        let text = std::str::from_utf8(bytes).map_err(|_| FeedError::InvalidUtf8)?;
        let mut urls = BTreeSet::new();
        for line in text.lines() {
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            urls.insert(canonical_url(line)?);
            if urls.len() > MAX_ENTRIES {
                return Err(FeedError::TooManyEntries);
            }
        }
        if urls.is_empty() {
            return Err(FeedError::Empty);
        }
        Ok(Self {
            provider: "urlhaus".into(),
            retrieved_at,
            expires_at,
            urls: urls.into_iter().collect(),
        })
    }
}

pub(crate) fn canonical_url(value: &str) -> Result<String, FeedError> {
    if value.len() > MAX_URL_BYTES || value.trim() != value {
        return Err(FeedError::InvalidUrl);
    }
    let parsed = Url::parse(value).map_err(|_| FeedError::InvalidUrl)?;
    if !matches!(parsed.scheme(), "http" | "https")
        || !parsed.has_host()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.fragment().is_some()
    {
        return Err(FeedError::InvalidUrl);
    }
    Ok(parsed.to_string())
}

impl UrlhausFeed {
    pub(crate) fn validate(&self) -> Result<(), FeedError> {
        if self.provider != "urlhaus" || self.expires_at <= self.retrieved_at {
            return Err(FeedError::InvalidExpiry);
        }
        let ttl = self.expires_at - self.retrieved_at;
        let reparsed = Self::parse(self.urls.join("\n").as_bytes(), self.retrieved_at, ttl)?;
        if reparsed.urls != self.urls {
            return Err(FeedError::InvalidUrl);
        }
        Ok(())
    }
}
