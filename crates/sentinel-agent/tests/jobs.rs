use sentinel_agent::jobs::{JobError, JobStore};
use sentinel_proto::jobs::JobState;

#[test]
fn owner_can_cancel_running_job_and_terminal_state_is_final() {
    let jobs = JobStore::new();
    let job = jobs.create("user-a").unwrap();
    jobs.start(&job.id, "user-a").unwrap();
    jobs.cancel(&job.id, "user-a").unwrap();
    assert_eq!(
        jobs.get(&job.id, "user-a").unwrap().state,
        JobState::Cancelled
    );
    assert_eq!(
        jobs.complete(&job.id, "user-a"),
        Err(JobError::InvalidTransition)
    );
}

#[test]
fn another_user_cannot_read_or_cancel_job() {
    let jobs = JobStore::new();
    let job = jobs.create("user-a").unwrap();
    assert_eq!(jobs.get(&job.id, "user-b"), Err(JobError::Forbidden));
    assert_eq!(jobs.cancel(&job.id, "user-b"), Err(JobError::Forbidden));
    assert_eq!(jobs.get("absent", "user-a"), Err(JobError::NotFound));
}
