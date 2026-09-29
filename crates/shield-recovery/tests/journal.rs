use shield_recovery::{Journal, JournalError, Lease};
use std::path::PathBuf;

fn path(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "cybershield-{name}-{}-{}.jsonl",
        std::process::id(),
        std::thread::current().name().unwrap_or("test")
    ))
}

#[test]
fn expired_lease_is_replayed_after_process_restart() {
    let path = path("lease-replay");
    let _ = std::fs::remove_file(&path);
    {
        let mut journal = Journal::open(&path).unwrap();
        journal
            .begin(Lease::new("test-1", "fixture-key", "prior", 10))
            .unwrap();
    }
    let mut journal = Journal::open(&path).unwrap();
    let mut restored = Vec::new();
    assert_eq!(
        journal
            .recover_expired(9, |lease| {
                restored.push(lease.clone());
                Ok(())
            })
            .unwrap(),
        0
    );
    assert_eq!(
        journal
            .recover_expired(10, |lease| {
                restored.push(lease.clone());
                Ok(())
            })
            .unwrap(),
        1
    );
    assert_eq!(restored[0].prior_value, "prior");
    assert_eq!(
        journal
            .recover_expired(11, |_| panic!("already restored"))
            .unwrap(),
        0
    );
    drop(journal);
    assert_eq!(Journal::open(&path).unwrap().active_count(), 0);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn duplicate_lease_and_torn_tail_do_not_hide_recorded_lease() {
    let path = path("torn-tail");
    let _ = std::fs::remove_file(&path);
    let lease = Lease::new("test-2", "fixture-key", "prior", 1);
    let mut journal = Journal::open(&path).unwrap();
    journal.begin(lease.clone()).unwrap();
    assert_eq!(journal.begin(lease), Err(JournalError::Duplicate));
    drop(journal);
    use std::io::Write;
    std::fs::OpenOptions::new()
        .append(true)
        .open(&path)
        .unwrap()
        .write_all(b"{\"kind\":")
        .unwrap();
    let mut reopened = Journal::open(&path).unwrap();
    assert_eq!(reopened.active_count(), 1);
    assert_eq!(reopened.recover_expired(1, |_| Ok(())).unwrap(), 1);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn failed_restore_remains_pending_for_next_attempt() {
    let path = path("restore-retry");
    let _ = std::fs::remove_file(&path);
    let mut journal = Journal::open(&path).unwrap();
    journal
        .begin(Lease::new("test-3", "fixture-key", "prior", 1))
        .unwrap();
    assert_eq!(
        journal.recover_expired(1, |_| Err(JournalError::Io)),
        Err(JournalError::RestoreFailed)
    );
    assert_eq!(journal.active_count(), 1);
    drop(journal);
    let mut reopened = Journal::open(&path).unwrap();
    assert_eq!(reopened.recover_expired(1, |_| Ok(())).unwrap(), 1);
    drop(reopened);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn complete_corrupt_record_is_not_silently_discarded() {
    let path = path("corrupt-record");
    let _ = std::fs::remove_file(&path);
    std::fs::write(&path, b"not-json\n").unwrap();
    assert_eq!(Journal::open(&path).err(), Some(JournalError::Corrupt));
    std::fs::remove_file(path).unwrap();
}
