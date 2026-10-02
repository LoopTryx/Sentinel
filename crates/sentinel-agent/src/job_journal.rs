use crate::jobs::{JobError, MAX_JOBS, MAX_OWNER_BYTES};
use sentinel_proto::jobs::{Job, JobState};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;

pub const MAX_JOURNAL_BYTES: u64 = 4 * 1024 * 1024;
const MAX_RECORD_BYTES: usize = 2048;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Record {
    version: u8,
    id: String,
    owner_ref: String,
    state: JobState,
}

pub(crate) struct JobJournal {
    file: File,
    bytes: u64,
    poisoned: bool,
}
type Replayed = (JobJournal, HashMap<String, Job>, u64);

impl JobJournal {
    pub fn open(path: &Path) -> Result<Replayed, JobError> {
        let mut options = OpenOptions::new();
        options.create(true).truncate(false).read(true).write(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            // Exclusive sharing and final-component no-follow; metadata below
            // rejects reparse points. Parent-directory protection is separate.
            options.share_mode(0).custom_flags(0x00200000);
        }
        let mut file = options.open(path).map_err(|_| JobError::Unavailable)?;
        file.try_lock().map_err(|_| JobError::Unavailable)?;
        let metadata = file.metadata().map_err(|_| JobError::Unavailable)?;
        if !metadata.is_file() {
            return Err(JobError::Corrupt);
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 {
                return Err(JobError::Corrupt);
            }
        }
        if metadata.len() > MAX_JOURNAL_BYTES {
            return Err(JobError::LimitReached);
        }
        let mut bytes = Vec::new();
        (&mut file)
            .take(MAX_JOURNAL_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| JobError::Unavailable)?;
        if bytes.len() as u64 > MAX_JOURNAL_BYTES {
            return Err(JobError::LimitReached);
        }
        if !bytes.is_empty() && !bytes.ends_with(b"\n") {
            return Err(JobError::Corrupt);
        }
        let mut jobs: HashMap<String, Job> = HashMap::new();
        let mut next_id = 1;
        for line in bytes
            .split(|byte| *byte == b'\n')
            .take(bytes.iter().filter(|byte| **byte == b'\n').count())
        {
            if line.is_empty() || line.len() + 1 > MAX_RECORD_BYTES {
                return Err(JobError::Corrupt);
            }
            let record: Record = serde_json::from_slice(line).map_err(|_| JobError::Corrupt)?;
            if record.version != 1
                || record.owner_ref.is_empty()
                || record.owner_ref.len() > MAX_OWNER_BYTES
            {
                return Err(JobError::Corrupt);
            }
            let job = Job {
                id: record.id,
                owner_ref: record.owner_ref,
                state: record.state,
            };
            if let Some(prior) = jobs.get(&job.id) {
                if job.owner_ref != prior.owner_ref {
                    return Err(JobError::Corrupt);
                }
                let mut expected = prior.clone();
                let result = match job.state {
                    JobState::Running => expected.start(),
                    JobState::Completed => expected.complete(),
                    JobState::Failed => expected.fail(),
                    JobState::Cancelled => expected.cancel(),
                    JobState::Queued => return Err(JobError::Corrupt),
                };
                result.map_err(|_| JobError::Corrupt)?;
            } else {
                if job.id != format!("job-{next_id}") || job.state != JobState::Queued {
                    return Err(JobError::Corrupt);
                }
                if jobs.len() >= MAX_JOBS {
                    return Err(JobError::LimitReached);
                }
                next_id += 1;
            }
            jobs.insert(job.id.clone(), job);
        }
        file.seek(SeekFrom::End(0))
            .map_err(|_| JobError::Unavailable)?;
        Ok((
            Self {
                file,
                bytes: bytes.len() as u64,
                poisoned: false,
            },
            jobs,
            next_id,
        ))
    }

    pub fn is_poisoned(&self) -> bool {
        self.poisoned
    }

    pub fn append(&mut self, job: &Job) -> Result<(), JobError> {
        if self.poisoned {
            return Err(JobError::Unavailable);
        }
        let record = Record {
            version: 1,
            id: job.id.clone(),
            owner_ref: job.owner_ref.clone(),
            state: job.state.clone(),
        };
        let mut line = serde_json::to_vec(&record).map_err(|_| JobError::Unavailable)?;
        line.push(b'\n');
        if line.len() > MAX_RECORD_BYTES || self.bytes + line.len() as u64 > MAX_JOURNAL_BYTES {
            return Err(JobError::LimitReached);
        }
        self.poisoned = true;
        self.file
            .write_all(&line)
            .and_then(|()| self.file.sync_all())
            .map_err(|_| JobError::Unavailable)?;
        self.bytes += line.len() as u64;
        self.poisoned = false;
        Ok(())
    }
}
