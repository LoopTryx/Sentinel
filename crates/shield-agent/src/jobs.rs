use shield_proto::jobs::{Job, JobState};
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum JobError {
    NotFound,
    Forbidden,
    InvalidTransition,
    Unavailable,
}

pub struct JobStore {
    next_id: AtomicU64,
    jobs: Mutex<HashMap<String, Job>>,
}

impl Default for JobStore {
    fn default() -> Self {
        Self::new()
    }
}

impl JobStore {
    pub fn new() -> Self {
        Self {
            next_id: AtomicU64::new(1),
            jobs: Mutex::new(HashMap::new()),
        }
    }

    pub fn create(&self, owner_ref: &str) -> Result<Job, JobError> {
        let id = format!("job-{}", self.next_id.fetch_add(1, Ordering::Relaxed));
        let job = Job::new(&id, owner_ref);
        self.jobs
            .lock()
            .map_err(|_| JobError::Unavailable)?
            .insert(id, job.clone());
        Ok(job)
    }

    pub fn get(&self, id: &str, owner_ref: &str) -> Result<Job, JobError> {
        let jobs = self.jobs.lock().map_err(|_| JobError::Unavailable)?;
        let job = jobs.get(id).ok_or(JobError::NotFound)?;
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
        transition: fn(&mut Job) -> Result<(), shield_proto::jobs::InvalidTransition>,
    ) -> Result<Job, JobError> {
        let mut jobs = self.jobs.lock().map_err(|_| JobError::Unavailable)?;
        let job = jobs.get_mut(id).ok_or(JobError::NotFound)?;
        if job.owner_ref != owner_ref {
            return Err(JobError::Forbidden);
        }
        transition(job).map_err(|_| JobError::InvalidTransition)?;
        Ok(job.clone())
    }

    pub fn count_by_state(&self, state: JobState) -> Result<usize, JobError> {
        let jobs = self.jobs.lock().map_err(|_| JobError::Unavailable)?;
        Ok(jobs.values().filter(|job| job.state == state).count())
    }
}
