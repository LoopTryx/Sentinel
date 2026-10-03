use crate::providers::{UrlhausFeed, canonical_url};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_SNAPSHOT_BYTES: u64 = 16 * 1024 * 1024;
const RETAINED_GENERATIONS: usize = 3;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CacheError {
    Io,
    InvalidFeed,
    StaleCandidate,
    Busy,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LookupVerdict {
    Listed,
    NotListed,
    Stale,
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
        let _lock = lock_directory(directory.as_ref())?;
        let active = verified_candidates(directory.as_ref())?
            .into_iter()
            .max_by_key(|(generation, feed)| (feed.retrieved_at, *generation));
        Ok(Self {
            directory: directory.as_ref().to_path_buf(),
            active: active.map(|(_, feed)| feed),
        })
    }

    pub fn activate(&mut self, feed: &UrlhausFeed) -> Result<(), CacheError> {
        feed.validate().map_err(|_| CacheError::InvalidFeed)?;
        let _lock = lock_directory(&self.directory)?;
        let previous = verified_candidates(&self.directory)?;
        self.active = previous
            .iter()
            .max_by_key(|(generation, feed)| (feed.retrieved_at, *generation))
            .map(|(_, feed)| feed.clone());
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
        let clock_generation = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| CacheError::Io)?
            .as_nanos();
        let mut generation = clock_generation;
        for entry in fs::read_dir(&self.directory).map_err(|_| CacheError::Io)? {
            let entry = entry.map_err(|_| CacheError::Io)?;
            if let Some((existing, _)) = owned_snapshot(&entry.path()) {
                generation = generation.max(existing.checked_add(1).ok_or(CacheError::Io)?);
            }
        }
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
        // Never prune until both replacement files have been synced and closed.
        drop(data);
        drop(marker);
        let mut keep = vec![generation];
        for (previous_generation, _) in previous.into_iter().rev() {
            if keep.len() == RETAINED_GENERATIONS {
                break;
            }
            keep.push(previous_generation);
        }
        prune_snapshots(&self.directory, &keep)?;
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
        let verdict = if now >= feed.expires_at {
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
    let mut marker = String::new();
    File::open(marker_path)
        .ok()?
        .take(65)
        .read_to_string(&mut marker)
        .ok()?;
    if marker.len() != 64 || !marker.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    let data_path = marker_path.with_extension("json");
    if fs::metadata(&data_path).ok()?.len() > MAX_SNAPSHOT_BYTES {
        return None;
    }
    let mut json = Vec::new();
    File::open(&data_path)
        .ok()?
        .take(MAX_SNAPSHOT_BYTES + 1)
        .read_to_end(&mut json)
        .ok()?;
    if json.len() as u64 > MAX_SNAPSHOT_BYTES {
        return None;
    }
    if format!("{:x}", Sha256::digest(&json)) != marker {
        return None;
    }
    let feed: UrlhausFeed = serde_json::from_slice(&json).ok()?;
    feed.validate().ok()?;
    Some(feed)
}

fn lock_directory(directory: &Path) -> Result<File, CacheError> {
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(directory.join(".snapshot.lock"))
        .map_err(|_| CacheError::Io)?;
    file.try_lock().map_err(|error| match error {
        std::fs::TryLockError::WouldBlock => CacheError::Busy,
        std::fs::TryLockError::Error(_) => CacheError::Io,
    })?;
    Ok(file)
}

fn owned_snapshot(path: &Path) -> Option<(u128, &str)> {
    let extension = path.extension()?.to_str()?;
    if extension != "json" && extension != "ready" {
        return None;
    }
    let digits = path.file_stem()?.to_str()?.strip_prefix("snapshot-")?;
    if digits.len() != 39 || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    Some((digits.parse().ok()?, extension))
}

fn verified_candidates(directory: &Path) -> Result<Vec<(u128, UrlhausFeed)>, CacheError> {
    let mut newest = BTreeMap::new();
    for entry in fs::read_dir(directory).map_err(|_| CacheError::Io)? {
        let entry = entry.map_err(|_| CacheError::Io)?;
        if !entry.file_type().map_err(|_| CacheError::Io)?.is_file() {
            continue;
        }
        let path = entry.path();
        if let Some((generation, "ready")) = owned_snapshot(&path) {
            newest.insert(generation, path);
            if newest.len() > RETAINED_GENERATIONS {
                newest.pop_first();
            }
        }
    }
    Ok(newest
        .into_iter()
        .filter_map(|(generation, path)| {
            read_verified_snapshot(&path).map(|feed| (generation, feed))
        })
        .collect())
}

fn prune_snapshots(directory: &Path, keep: &[u128]) -> Result<(), CacheError> {
    for entry in fs::read_dir(directory).map_err(|_| CacheError::Io)? {
        let entry = entry.map_err(|_| CacheError::Io)?;
        if !entry.file_type().map_err(|_| CacheError::Io)?.is_file() {
            continue;
        }
        let path = entry.path();
        if let Some((generation, _)) = owned_snapshot(&path)
            && !keep.contains(&generation)
        {
            fs::remove_file(path).map_err(|_| CacheError::Io)?;
        }
    }
    Ok(())
}
