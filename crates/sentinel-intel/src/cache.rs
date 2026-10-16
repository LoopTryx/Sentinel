use crate::providers::{UrlhausFeed, canonical_url};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_SNAPSHOT_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CacheError {
    Io,
    InvalidFeed,
    StaleCandidate,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LookupVerdict {
    Listed,
    NotListed,
    Stale,
    /// The clock precedes retrieval; freshness cannot be established.
    ClockAnomaly,
    Unavailable,
    InvalidUrl,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupResult {
    pub verdict: LookupVerdict,
    pub provider: Option<String>,
    pub retrieved_at: Option<u64>,
    pub expires_at: Option<u64>,
}

pub struct Cache {
    directory: PathBuf,
    active: Option<UrlhausFeed>,
}

impl Cache {
    pub fn open(directory: impl AsRef<Path>) -> Result<Self, CacheError> {
        fs::create_dir_all(directory.as_ref()).map_err(|_| CacheError::Io)?;
        let mut active: Option<(UrlhausFeed, PathBuf)> = None;
        for entry in fs::read_dir(directory.as_ref()).map_err(|_| CacheError::Io)? {
            let path = entry.map_err(|_| CacheError::Io)?.path();
            if path
                .extension()
                .is_none_or(|extension| extension != "ready")
            {
                continue;
            }
            let Some(feed) = read_verified_snapshot(&path) else {
                continue;
            };
            let newer = active.as_ref().is_none_or(|(current, current_path)| {
                (feed.retrieved_at, &path) > (current.retrieved_at, current_path)
            });
            if newer {
                active = Some((feed, path));
            }
        }
        Ok(Self {
            directory: directory.as_ref().to_path_buf(),
            active: active.map(|(feed, _)| feed),
        })
    }

    pub fn activate(&mut self, feed: &UrlhausFeed) -> Result<(), CacheError> {
        feed.validate().map_err(|_| CacheError::InvalidFeed)?;
        if self
            .active
            .as_ref()
            .is_some_and(|current| feed.retrieved_at <= current.retrieved_at)
        {
            return Err(CacheError::StaleCandidate);
        }
        let json = serde_json::to_vec(feed).map_err(|_| CacheError::InvalidFeed)?;
        if json.len() as u64 > MAX_SNAPSHOT_BYTES {
            return Err(CacheError::InvalidFeed);
        }
        let generation = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| CacheError::Io)?
            .as_nanos();
        let name = format!("snapshot-{generation:039}");
        let data_path = self.directory.join(format!("{name}.json"));
        let marker_path = self.directory.join(format!("{name}.ready"));
        let mut data = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(data_path)
            .map_err(|_| CacheError::Io)?;
        data.write_all(&json).map_err(|_| CacheError::Io)?;
        data.sync_all().map_err(|_| CacheError::Io)?;
        let digest = format!("{:x}", Sha256::digest(&json));
        let mut marker = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(marker_path)
            .map_err(|_| CacheError::Io)?;
        marker
            .write_all(digest.as_bytes())
            .map_err(|_| CacheError::Io)?;
        marker.sync_all().map_err(|_| CacheError::Io)?;
        self.active = Some(feed.clone());
        Ok(())
    }

    pub fn lookup(&self, value: &str, now: u64) -> LookupResult {
        let normalized = match canonical_url(value) {
            Ok(value) => value,
            Err(_) => {
                return LookupResult {
                    verdict: LookupVerdict::InvalidUrl,
                    provider: None,
                    retrieved_at: None,
                    expires_at: None,
                };
            }
        };
        let Some(feed) = &self.active else {
            return LookupResult {
                verdict: LookupVerdict::Unavailable,
                provider: None,
                retrieved_at: None,
                expires_at: None,
            };
        };
        let verdict = if now < feed.retrieved_at {
            LookupVerdict::ClockAnomaly
        } else if now >= feed.expires_at {
            LookupVerdict::Stale
        } else if feed.urls.binary_search(&normalized).is_ok() {
            LookupVerdict::Listed
        } else {
            LookupVerdict::NotListed
        };
        LookupResult {
            verdict,
            provider: Some(feed.provider.clone()),
            retrieved_at: Some(feed.retrieved_at),
            expires_at: Some(feed.expires_at),
        }
    }
}

fn read_verified_snapshot(marker_path: &Path) -> Option<UrlhausFeed> {
    let marker = fs::read_to_string(marker_path).ok()?;
    if marker.len() != 64 || !marker.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    let data_path = marker_path.with_extension("json");
    if fs::metadata(&data_path).ok()?.len() > MAX_SNAPSHOT_BYTES {
        return None;
    }
    let json = fs::read(&data_path).ok()?;
    if format!("{:x}", Sha256::digest(&json)) != marker {
        return None;
    }
    let feed: UrlhausFeed = serde_json::from_slice(&json).ok()?;
    feed.validate().ok()?;
    Some(feed)
}
