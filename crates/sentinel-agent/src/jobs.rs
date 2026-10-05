use crate::job_journal::JobJournal;
use sentinel_proto::jobs::{Job, JobState};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

pub const MAX_JOBS: usize = 4096;
pub const MAX_OWNER_BYTES: usize = 256;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum JobError {
    NotFound,
    Forbidden,
    InvalidTransition,
    InvalidOwner,
    Unavailable,
    Corrupt,
    LimitReached,
}

pub struct JobStore {
    state: Mutex<StoreState>,
}
struct StoreState {
    next_id: u64,
    jobs: HashMap<String, Job>,
    journal: Option<JobJournal>,
}

impl Default for JobStore {
    fn default() -> Self {
        Self::new()
    }
}

impl JobStore {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(StoreState {
                next_id: 1,
                jobs: HashMap::new(),
                journal: None,
            }),
        }
    }

    pub fn open(path: impl AsRef<Path>) -> Result<Self, JobError> {
        let (journal, jobs, next_id) = JobJournal::open(path.as_ref())?;
        let mut state = StoreState {
            next_id,
            jobs,
            journal: Some(journal),
        };
        let mut interrupted: Vec<Job> = state
            .jobs
            .values()
            .filter(|job| matches!(job.state, JobState::Queued | JobState::Running))
            .cloned()
            .collect();
        interrupted.sort_by(|a, b| a.id.cmp(&b.id));
        for mut job in interrupted {
            if job.state == JobState::Running {
                job.fail()
            } else {
                job.cancel()
            }
            .map_err(|_| JobError::Corrupt)?;
            state.persist(&job)?;
            state.jobs.insert(job.id.clone(), job);
        }
        Ok(Self {
            state: Mutex::new(state),
        })
    }

    pub fn create(&self, owner_ref: &str) -> Result<Job, JobError> {
        if owner_ref.is_empty() || owner_ref.len() > MAX_OWNER_BYTES {
            return Err(JobError::InvalidOwner);
        }
        let mut state = self.state.lock().map_err(|_| JobError::Unavailable)?;
        state.available()?;
        if state.jobs.len() >= MAX_JOBS {
            return Err(JobError::LimitReached);
        }
        let job = Job::new(&format!("job-{}", state.next_id), owner_ref);
        state.persist(&job)?;
        state.next_id += 1;
        state.jobs.insert(job.id.clone(), job.clone());
        Ok(job)
    }

    pub fn get(&self, id: &str, owner_ref: &str) -> Result<Job, JobError> {
        let state = self.state.lock().map_err(|_| JobError::Unavailable)?;
        state.available()?;
        let job = state.jobs.get(id).ok_or(JobError::NotFound)?;
        if job.owner_ref != owner_ref {
            return Err(JobError::Forbidden);
        }
        Ok(job.clone())
    }

    pub fn start(&self, id: &str, owner_ref: &str) -> Result<Job, JobError> {
        self.change(id, owner_ref, Job::start)
    }
    pub fn complete(&self, id: &str, owner_ref: &str) -> Result<Job, JobError> {
        self.change(id, owner_ref, Job::complete)
    }
    pub fn fail(&self, id: &str, owner_ref: &str) -> Result<Job, JobError> {
        self.change(id, owner_ref, Job::fail)
    }
    pub fn cancel(&self, id: &str, owner_ref: &str) -> Result<Job, JobError> {
        self.change(id, owner_ref, Job::cancel)
    }

    fn change(
        &self,
        id: &str,
        owner_ref: &str,
        transition: fn(&mut Job) -> Result<(), sentinel_proto::jobs::InvalidTransition>,
    ) -> Result<Job, JobError> {
        let mut state = self.state.lock().map_err(|_| JobError::Unavailable)?;
        state.available()?;
        let mut job = state.jobs.get(id).ok_or(JobError::NotFound)?.clone();
        if job.owner_ref != owner_ref {
            return Err(JobError::Forbidden);
        }
        transition(&mut job).map_err(|_| JobError::InvalidTransition)?;
        state.persist(&job)?;
        state.jobs.insert(job.id.clone(), job.clone());
        Ok(job)
    }

    pub fn count_by_state(&self, state: JobState) -> Result<usize, JobError> {
        let store = self.state.lock().map_err(|_| JobError::Unavailable)?;
        store.available()?;
        Ok(store.jobs.values().filter(|job| job.state == state).count())
    }
}

impl StoreState {
    fn available(&self) -> Result<(), JobError> {
        if self.journal.as_ref().is_some_and(JobJournal::is_poisoned) {
            Err(JobError::Unavailable)
        } else {
            Ok(())
        }
    }
    fn persist(&mut self, job: &Job) -> Result<(), JobError> {
        if let Some(journal) = &mut self.journal {
            journal.append(job, &self.jobs)?;
        }
        Ok(())
    }
}
