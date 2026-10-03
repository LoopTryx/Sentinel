use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Lease {
    pub id: String,
    pub target: String,
    pub prior_value: String,
    pub expires_at: u64,
}

impl Lease {
    pub fn new(id: &str, target: &str, prior_value: &str, expires_at: u64) -> Self {
        Self {
            id: id.into(),
            target: target.into(),
            prior_value: prior_value.into(),
            expires_at,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum JournalError {
    Io,
    Busy,
    Corrupt,
    Duplicate,
    RestoreFailed,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum Event {
    Begin { lease: Lease },
    Restored { id: String },
}

pub struct Journal {
    file: File,
    active: HashMap<String, Lease>,
}

impl Journal {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, JournalError> {
        let mut file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(path)
            .map_err(|_| JournalError::Io)?;
        // Lock before replay or tail truncation, and retain ownership until File drops.
        file.try_lock().map_err(|error| match error {
            std::fs::TryLockError::WouldBlock => JournalError::Busy,
            std::fs::TryLockError::Error(_) => JournalError::Io,
        })?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).map_err(|_| JournalError::Io)?;
        let complete = bytes
            .iter()
            .rposition(|byte| *byte == b'\n')
            .map_or(0, |index| index + 1);
        let mut active = HashMap::new();
        for line in bytes[..complete]
            .split(|byte| *byte == b'\n')
            .filter(|line| !line.is_empty())
        {
            let event: Event = serde_json::from_slice(line).map_err(|_| JournalError::Corrupt)?;
            match event {
                Event::Begin { lease } => {
                    if active.insert(lease.id.clone(), lease).is_some() {
                        return Err(JournalError::Corrupt);
                    }
                }
                Event::Restored { id } => {
                    if active.remove(&id).is_none() {
                        return Err(JournalError::Corrupt);
                    }
                }
            }
        }
        file.set_len(complete as u64)
            .map_err(|_| JournalError::Io)?;
        file.seek(SeekFrom::End(0)).map_err(|_| JournalError::Io)?;
        Ok(Self { file, active })
    }

    pub fn begin(&mut self, lease: Lease) -> Result<(), JournalError> {
        if self.active.contains_key(&lease.id) {
            return Err(JournalError::Duplicate);
        }
        self.append(&Event::Begin {
            lease: lease.clone(),
        })?;
        self.active.insert(lease.id.clone(), lease);
        Ok(())
    }

    pub fn active_count(&self) -> usize {
        self.active.len()
    }

    pub fn recover_expired<F>(&mut self, now: u64, mut restore: F) -> Result<usize, JournalError>
    where
        F: FnMut(&Lease) -> Result<(), JournalError>,
    {
        let mut due: Vec<Lease> = self
            .active
            .values()
            .filter(|lease| lease.expires_at <= now)
            .cloned()
            .collect();
        due.sort_by(|left, right| left.id.cmp(&right.id));
        for lease in &due {
            restore(lease).map_err(|_| JournalError::RestoreFailed)?;
            self.append(&Event::Restored {
                id: lease.id.clone(),
            })?;
            self.active.remove(&lease.id);
        }
        Ok(due.len())
    }

    fn append(&mut self, event: &Event) -> Result<(), JournalError> {
        let mut line = serde_json::to_vec(event).map_err(|_| JournalError::Corrupt)?;
        line.push(b'\n');
        self.file.write_all(&line).map_err(|_| JournalError::Io)?;
        self.file.sync_all().map_err(|_| JournalError::Io)
    }
}
