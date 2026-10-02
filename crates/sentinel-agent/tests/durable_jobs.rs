use sentinel_agent::jobs::{JobError, JobStore};
use sentinel_proto::jobs::JobState;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Barrier};

fn path(name: &str) -> PathBuf {
    let path =
        std::env::temp_dir().join(format!("sentinel-jobs-{}-{name}.jsonl", std::process::id()));
    let _ = fs::remove_file(&path);
    path
}

#[test]
fn terminal_state_owner_and_ids_survive_restart() {
    let path = path("terminal");
    let first;
    {
        let store = JobStore::open(&path).unwrap();
        first = store.create("sid-a:session-1").unwrap();
        store.start(&first.id, &first.owner_ref).unwrap();
        store.complete(&first.id, &first.owner_ref).unwrap();
    }
    {
        let store = JobStore::open(&path).unwrap();
        assert_eq!(
            store.get(&first.id, &first.owner_ref).unwrap().state,
            JobState::Completed
        );
        assert_eq!(
            store.get(&first.id, "sid-b:session-1"),
            Err(JobError::Forbidden)
        );
        assert_eq!(
            store.cancel(&first.id, "sid-a:session-2"),
            Err(JobError::Forbidden)
        );
        assert_ne!(store.create(&first.owner_ref).unwrap().id, first.id);
    }
    fs::remove_file(path).unwrap();
}

#[test]
fn interrupted_jobs_recover_to_explicit_terminal_states() {
    let path = path("recovery");
    let (queued, running);
    {
        let store = JobStore::open(&path).unwrap();
        queued = store.create("owner").unwrap();
        running = store.create("owner").unwrap();
        store.start(&running.id, "owner").unwrap();
    }
    for _ in 0..2 {
        let store = JobStore::open(&path).unwrap();
        assert_eq!(
            store.get(&queued.id, "owner").unwrap().state,
            JobState::Cancelled
        );
        assert_eq!(
            store.get(&running.id, "owner").unwrap().state,
            JobState::Failed
        );
        assert_eq!(
            store.complete(&running.id, "owner"),
            Err(JobError::InvalidTransition)
        );
    }
    fs::remove_file(path).unwrap();
}

#[test]
fn another_writer_is_denied_until_the_first_store_closes() {
    let path = path("exclusive");
    let store = JobStore::open(&path).unwrap();
    assert!(matches!(JobStore::open(&path), Err(JobError::Unavailable)));
    drop(store);
    drop(JobStore::open(&path).unwrap());
    fs::remove_file(path).unwrap();
}

fn record(id: &str, owner: &str, state: &str) -> Vec<u8> {
    let mut bytes = serde_json::to_vec(&serde_json::json!({
        "version": 1, "id": id, "ownerRef": owner, "state": state
    }))
    .unwrap();
    bytes.push(b'\n');
    bytes
}

#[test]
fn corrupt_and_torn_records_are_rejected_without_rewriting_evidence() {
    let queued = record("job-1", "owner", "queued");
    let cases = [
        b"not-json\n".to_vec(),
        queued[..queued.len()-1].to_vec(),
        [queued.clone(), queued.clone()].concat(),
        [queued.clone(), record("job-1", "other-owner", "running")].concat(),
        [queued.clone(), record("job-1", "owner", "completed")].concat(),
        record("job-2", "owner", "queued"),
        record("job-1", "", "queued"),
        b"{\"version\":2,\"id\":\"job-1\",\"ownerRef\":\"owner\",\"state\":\"queued\"}\n".to_vec(),
        [queued.clone(), record("job-1", "owner", "cancelled"), record("job-1", "owner", "running")].concat(),
        b"{\"version\":1,\"id\":\"job-1\",\"ownerRef\":\"owner\",\"state\":\"queued\",\"unexpected\":true}\n".to_vec(),
        [vec![b' '; 2048], b"\n".to_vec()].concat(),
    ];
    for (index, bytes) in cases.iter().enumerate() {
        let path = path(&format!("corrupt-{index}"));
        fs::write(&path, bytes).unwrap();
        assert!(
            matches!(JobStore::open(&path), Err(JobError::Corrupt)),
            "case {index}"
        );
        assert_eq!(&fs::read(&path).unwrap(), bytes);
        fs::remove_file(path).unwrap();
    }
}

#[test]
fn journal_job_and_owner_limits_are_enforced() {
    let path = path("oversized");
    let file = fs::File::create(&path).unwrap();
    file.set_len(4 * 1024 * 1024 + 1).unwrap();
    drop(file);
    assert!(matches!(JobStore::open(&path), Err(JobError::LimitReached)));
    assert_eq!(fs::metadata(&path).unwrap().len(), 4 * 1024 * 1024 + 1);
    fs::remove_file(path).unwrap();

    let store = JobStore::new();
    assert_eq!(store.create(""), Err(JobError::InvalidOwner));
    assert_eq!(store.create(&"o".repeat(257)), Err(JobError::InvalidOwner));
    for _ in 0..sentinel_agent::jobs::MAX_JOBS {
        store.create("owner").unwrap();
    }
    assert_eq!(store.create("owner"), Err(JobError::LimitReached));
}

#[test]
fn completion_and_cancellation_have_one_durable_winner() {
    let path = path("race");
    let store = Arc::new(JobStore::open(&path).unwrap());
    let job = store.create("owner").unwrap();
    store.start(&job.id, "owner").unwrap();
    let barrier = Arc::new(Barrier::new(3));
    let handles: Vec<_> = [true, false]
        .into_iter()
        .map(|complete| {
            let store = Arc::clone(&store);
            let barrier = Arc::clone(&barrier);
            let id = job.id.clone();
            std::thread::spawn(move || {
                barrier.wait();
                if complete {
                    store.complete(&id, "owner")
                } else {
                    store.cancel(&id, "owner")
                }
            })
        })
        .collect();
    barrier.wait();
    let results: Vec<_> = handles
        .into_iter()
        .map(|handle| handle.join().unwrap())
        .collect();
    assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|result| **result == Err(JobError::InvalidTransition))
            .count(),
        1
    );
    let winner = store.get(&job.id, "owner").unwrap();
    drop(store);
    let reopened = JobStore::open(&path).unwrap();
    assert_eq!(reopened.get(&job.id, "owner").unwrap(), winner);
    drop(reopened);
    fs::remove_file(path).unwrap();
}
