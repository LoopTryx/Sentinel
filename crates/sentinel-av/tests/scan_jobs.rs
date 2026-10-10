use sentinel_av::scan_jobs::{SelectedJobs, SelectionKind};
use std::time::{Duration, Instant};

#[test]
fn selection_is_single_use_owner_bound_and_produces_real_report() {
    let root = std::env::temp_dir().join(format!("sentinel-job-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("ordinary.txt");
    let bytes = b"ordinary harmless job bytes";
    std::fs::write(&path, bytes).unwrap();
    let mut jobs = SelectedJobs::default();
    let selection = jobs
        .select("trusted-main", path, SelectionKind::File, Instant::now())
        .unwrap();
    assert!(jobs.start("foreign", &selection, Instant::now()).is_err());
    let job = jobs
        .start("trusted-main", &selection, Instant::now())
        .unwrap();
    assert!(jobs
        .start("trusted-main", &selection, Instant::now())
        .is_err());
    assert!(jobs.poll("foreign", &job).is_err());
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let snapshot = jobs.poll("trusted-main", &job).unwrap();
        if snapshot.finished {
            assert_eq!(snapshot.reports.len(), 1);
            assert_eq!(snapshot.reports[0].state, "completed");
            assert_eq!(snapshot.reports[0].bytes_inspected, bytes.len() as u64);
            break;
        }
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(10));
    }
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn expired_selection_refuses_without_filesystem_access() {
    let mut jobs = SelectedJobs::default();
    let now = Instant::now();
    assert!(jobs
        .select("", "nonexistent".into(), SelectionKind::File, now)
        .is_err());
    let selection = jobs
        .select(
            "trusted-main",
            "nonexistent".into(),
            SelectionKind::File,
            now,
        )
        .unwrap();
    assert!(jobs
        .start("trusted-main", &selection, now + Duration::from_secs(61))
        .is_err());
    assert!(jobs.start("trusted-main", &selection, now).is_err());
}

#[test]
fn cancellation_keeps_worker_admission_until_actual_exit() {
    use std::sync::{mpsc, Arc, Mutex};
    let root = std::env::temp_dir().join(format!("sentinel-job-cancel-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("ordinary.txt");
    std::fs::write(&path, b"ordinary harmless cancellation bytes").unwrap();
    let (entered_tx, entered_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let release_rx = Mutex::new(release_rx);
    let mut jobs = SelectedJobs::with_hash_lookup(Arc::new(move |_| {
        entered_tx.send(()).unwrap();
        let _ = release_rx
            .lock()
            .unwrap()
            .recv_timeout(Duration::from_secs(10));
        None
    }));
    let now = Instant::now();
    let selected = jobs
        .select("trusted-main", path.clone(), SelectionKind::File, now)
        .unwrap();
    let job = jobs.start("trusted-main", &selected, now).unwrap();
    entered_rx.recv_timeout(Duration::from_secs(10)).unwrap();
    assert!(jobs.cancel("foreign", &job).is_err());
    jobs.cancel("trusted-main", &job).unwrap();
    let snapshot = jobs.poll("trusted-main", &job).unwrap();
    let next = jobs
        .select("trusted-main", path, SelectionKind::File, now)
        .unwrap();
    let busy = jobs.start("trusted-main", &next, now).is_err();
    release_tx.send(()).unwrap();
    assert!(snapshot.cancellation_requested && !snapshot.finished && busy);
    let deadline = Instant::now() + Duration::from_secs(10);
    while !jobs.poll("trusted-main", &job).unwrap().finished {
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(10));
    }
    // Only the first worker is deliberately held. Release the callback for the
    // next worker too, rather than testing its ten-second safety timeout.
    release_tx.send(()).unwrap();
    let next_job = jobs.start("trusted-main", &next, now).unwrap();
    assert!(jobs.poll("trusted-main", &job).is_err());
    while !jobs.poll("trusted-main", &next_job).unwrap().finished {
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(10));
    }
    std::fs::remove_dir_all(root).unwrap();
}
