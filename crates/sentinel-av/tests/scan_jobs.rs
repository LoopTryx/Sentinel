use sentinel_av::scan_jobs::{SelectedJobs, SelectionKind};
use std::time::{Duration, Instant};

#[cfg(windows)]
#[test]
fn directory_scan_marks_nested_junction_without_reading_its_target() {
    let root =
        std::env::temp_dir().join(format!("sentinel-tree-junction-{}", uuid::Uuid::new_v4()));
    let chosen = root.join("chosen");
    let outside = root.join("outside");
    std::fs::create_dir(&root).unwrap();
    std::fs::create_dir(&chosen).unwrap();
    std::fs::create_dir(&outside).unwrap();
    let ordinary = b"harmless chosen bytes";
    std::fs::write(chosen.join("ordinary.txt"), ordinary).unwrap();
    std::fs::write(outside.join("outside.txt"), b"outside selected tree").unwrap();
    let link = chosen.join("link");
    let result = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(&link)
        .arg(&outside)
        .output()
        .unwrap();
    assert!(result.status.success());
    let reports = sentinel_av::engine::scan_directory(
        &sentinel_av::engine::Engine::default(),
        &chosen,
        &|_| None,
    );
    std::fs::remove_dir(&link).unwrap();
    assert_eq!(
        std::fs::read(outside.join("outside.txt")).unwrap(),
        b"outside selected tree"
    );
    for (folder, name) in [(&chosen, "ordinary.txt"), (&outside, "outside.txt")] {
        std::fs::remove_file(folder.join(name)).unwrap();
        std::fs::remove_dir(folder).unwrap();
    }
    std::fs::remove_dir(root).unwrap();
    assert_eq!(reports.len(), 2);
    assert_eq!(
        reports
            .iter()
            .map(|report| report.bytes_inspected)
            .sum::<u64>(),
        ordinary.len() as u64
    );
    assert!(reports
        .iter()
        .any(|report| report.state == "unsupported" && std::path::Path::new(&report.path) == link));
    assert!(reports
        .iter()
        .all(|report| std::path::Path::new(&report.path).starts_with(&chosen)));
}

#[cfg(windows)]
#[test]
fn selection_refuses_junction_ancestors_without_reading_outside_subject() {
    let root = std::env::temp_dir().join(format!("sentinel-job-junction-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let target = root.join("target");
    std::fs::create_dir(&target).unwrap();
    std::fs::write(target.join("ordinary.txt"), b"harmless outside subject").unwrap();
    let link = root.join("link");
    let result = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(&link)
        .arg(&target)
        .output()
        .unwrap();
    assert!(result.status.success());
    let mut jobs = SelectedJobs::default();
    let file_refused = jobs
        .select(
            "trusted-main",
            link.join("ordinary.txt"),
            SelectionKind::File,
            Instant::now(),
        )
        .is_err();
    std::fs::create_dir(target.join("nested")).unwrap();
    let directory_refused = jobs
        .select(
            "trusted-main",
            link.join("nested"),
            SelectionKind::Directory,
            Instant::now(),
        )
        .is_err();
    let report =
        sentinel_av::engine::Engine::default().scan_file(&link.join("ordinary.txt"), &|_| None);
    let engine_refused = report.bytes_inspected == 0 && report.verdict == "unknown";
    let directory_reports = sentinel_av::engine::scan_directory(
        &sentinel_av::engine::Engine::default(),
        &link.join("nested"),
        &|_| None,
    );
    let directory_engine_refused = directory_reports.len() == 1
        && directory_reports[0].bytes_inspected == 0
        && directory_reports[0].state == "access_error";
    drop(jobs);
    std::fs::remove_dir(link).unwrap();
    assert_eq!(
        std::fs::read(target.join("ordinary.txt")).unwrap(),
        b"harmless outside subject"
    );
    std::fs::remove_file(target.join("ordinary.txt")).unwrap();
    std::fs::remove_dir(target.join("nested")).unwrap();
    std::fs::remove_dir(target).unwrap();
    std::fs::remove_dir(root).unwrap();
    assert!(
        file_refused && directory_refused && engine_refused && directory_engine_refused,
        "junction ancestors must not grant selected-file/folder references"
    );
}

#[cfg(windows)]
#[test]
fn selected_directory_root_is_retained_until_actual_scan_exit() {
    use std::sync::{mpsc, Arc, Mutex};
    let root = std::env::temp_dir().join(format!("sentinel-job-dir-held-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let selected_path = root.join("selected");
    std::fs::create_dir(&selected_path).unwrap();
    std::fs::write(
        selected_path.join("ordinary.txt"),
        b"harmless directory report",
    )
    .unwrap();
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
    let selected = jobs
        .select(
            "trusted-main",
            selected_path.clone(),
            SelectionKind::Directory,
            Instant::now(),
        )
        .unwrap();
    let refused = std::fs::rename(&selected_path, root.join("renamed")).is_err();
    assert!(
        refused,
        "directory selection must retain its root before start"
    );
    let job = jobs
        .start("trusted-main", &selected, Instant::now())
        .unwrap();
    entered_rx.recv_timeout(Duration::from_secs(10)).unwrap();
    let running_refused = std::fs::rename(&selected_path, root.join("renamed")).is_err();
    release_tx.send(()).unwrap();
    assert!(
        running_refused,
        "directory root must remain retained while the worker runs"
    );
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let snapshot = jobs.poll_wire("trusted-main", &job).unwrap();
        if snapshot.state == sentinel_proto::selected_scan::ScanWorkerState::Finished {
            assert_eq!(snapshot.selection_ref, selected);
            assert_eq!(snapshot.reports.len(), 1);
            assert_eq!(snapshot.reports[0].inspected_bytes, "25");
            break;
        }
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(10));
    }
    std::fs::rename(&selected_path, root.join("renamed")).unwrap();
    std::fs::remove_file(root.join("renamed/ordinary.txt")).unwrap();
    std::fs::remove_dir(root.join("renamed")).unwrap();
    std::fs::remove_dir(root).unwrap();
}

#[cfg(windows)]
#[test]
fn native_maintenance_releases_idle_selection_at_exact_expiry() {
    let root =
        std::env::temp_dir().join(format!("sentinel-job-idle-expiry-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("ordinary.txt");
    std::fs::write(&path, b"harmless idle bytes").unwrap();
    let mut jobs = SelectedJobs::default();
    let now = Instant::now();
    let reference = jobs
        .select("trusted-main", path.clone(), SelectionKind::File, now)
        .unwrap();
    assert!(!jobs.maintain(now + Duration::from_secs(59)));
    assert!(std::fs::OpenOptions::new().write(true).open(&path).is_err());
    assert!(jobs.maintain(now + Duration::from_secs(60)));
    assert!(!jobs.maintain(now + Duration::from_secs(61)));
    assert!(std::fs::OpenOptions::new().write(true).open(&path).is_ok());
    assert!(jobs.start("trusted-main", &reference, now).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), b"harmless idle bytes");
    std::fs::remove_file(path).unwrap();
    std::fs::remove_dir(root).unwrap();
}

#[cfg(windows)]
#[test]
fn expired_selection_releases_while_another_worker_is_busy() {
    use std::sync::{mpsc, Arc, Mutex};
    let root =
        std::env::temp_dir().join(format!("sentinel-job-busy-expiry-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let first = root.join("first.txt");
    let second = root.join("second.txt");
    std::fs::write(&first, b"harmless first job").unwrap();
    std::fs::write(&second, b"harmless unstarted selection").unwrap();
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
    let first_ref = jobs
        .select("trusted-main", first.clone(), SelectionKind::File, now)
        .unwrap();
    let job = jobs.start("trusted-main", &first_ref, now).unwrap();
    entered_rx.recv_timeout(Duration::from_secs(10)).unwrap();
    let second_ref = jobs
        .select("trusted-main", second.clone(), SelectionKind::File, now)
        .unwrap();
    assert!(std::fs::OpenOptions::new()
        .write(true)
        .open(&second)
        .is_err());
    let refused = jobs
        .start("trusted-main", &second_ref, now + Duration::from_secs(60))
        .is_err();
    let released = std::fs::OpenOptions::new()
        .write(true)
        .open(&second)
        .is_ok();
    release_tx.send(()).unwrap();
    let deadline = Instant::now() + Duration::from_secs(10);
    while !jobs.poll("trusted-main", &job).unwrap().finished {
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(10));
    }
    drop(jobs);
    std::fs::remove_file(first).unwrap();
    std::fs::remove_file(second).unwrap();
    std::fs::remove_dir(root).unwrap();
    assert!(
        refused && released,
        "busy admission must not retain an expired selected file"
    );
}

#[cfg(windows)]
#[test]
fn selected_file_is_retained_before_start_and_released_after_completion() {
    let root = std::env::temp_dir().join(format!("sentinel-job-held-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("ordinary.txt");
    let bytes = b"original harmless selected bytes";
    std::fs::write(&path, bytes).unwrap();
    let mut jobs = SelectedJobs::default();
    let selected = jobs
        .select(
            "trusted-main",
            path.clone(),
            SelectionKind::File,
            Instant::now(),
        )
        .unwrap();
    assert!(jobs
        .select(
            "trusted-main",
            root.clone(),
            SelectionKind::File,
            Instant::now()
        )
        .is_err());
    let write_refused = std::fs::OpenOptions::new().write(true).open(&path).is_err();
    let rename_refused = std::fs::rename(&path, root.join("replacement.txt")).is_err();
    assert!(
        write_refused && rename_refused,
        "selection must retain original read-only subject before start"
    );
    let job = jobs
        .start("trusted-main", &selected, Instant::now())
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let snapshot = jobs.poll("trusted-main", &job).unwrap();
        if snapshot.finished {
            assert_eq!(snapshot.reports[0].bytes_inspected, bytes.len() as u64);
            let wire = jobs.poll_wire("trusted-main", &job).unwrap();
            assert_eq!(wire.selection_ref, selected);
            assert_eq!(wire.job_ref, job);
            assert_eq!(wire.reports[0].inspected_bytes, bytes.len().to_string());
            assert!(wire.validate().is_ok());
            assert!(jobs.poll_wire("foreign", &job).is_err());
            let json = serde_json::to_string(&wire).unwrap();
            assert!(!json.contains("ordinary.txt"));
            assert!(!json.contains(&root.to_string_lossy().to_string()));
            assert_eq!(snapshot.reports[0].state, "completed");
            break;
        }
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(10));
    }
    assert!(std::fs::OpenOptions::new().write(true).open(&path).is_ok());
    std::fs::remove_file(path).unwrap();
    std::fs::remove_dir(root).unwrap();
}

#[cfg(windows)]
#[test]
fn dropping_unstarted_selection_releases_only_its_handle() {
    let root = std::env::temp_dir().join(format!("sentinel-job-drop-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("ordinary.txt");
    std::fs::write(&path, b"harmless drop bytes").unwrap();
    let mut jobs = SelectedJobs::default();
    jobs.select(
        "trusted-main",
        path.clone(),
        SelectionKind::File,
        Instant::now(),
    )
    .unwrap();
    assert!(std::fs::OpenOptions::new().write(true).open(&path).is_err());
    drop(jobs);
    assert!(std::fs::OpenOptions::new().write(true).open(&path).is_ok());
    assert_eq!(std::fs::read(&path).unwrap(), b"harmless drop bytes");
    std::fs::remove_file(path).unwrap();
    std::fs::remove_dir(root).unwrap();
}

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
fn expired_selection_releases_handle_and_refuses_replay() {
    let root = std::env::temp_dir().join(format!("sentinel-job-expiry-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("ordinary.txt");
    std::fs::write(&path, b"harmless expiry bytes").unwrap();
    let mut jobs = SelectedJobs::default();
    let now = Instant::now();
    assert!(jobs
        .select("", path.clone(), SelectionKind::File, now)
        .is_err());
    assert!(jobs
        .select(
            "trusted-main",
            root.join("missing.txt"),
            SelectionKind::File,
            now
        )
        .is_err());
    let selection = jobs
        .select("trusted-main", path.clone(), SelectionKind::File, now)
        .unwrap();
    assert!(jobs
        .start("trusted-main", &selection, now + Duration::from_secs(61))
        .is_err());
    assert!(std::fs::OpenOptions::new().write(true).open(&path).is_ok());
    std::fs::remove_file(path).unwrap();
    assert!(jobs.start("trusted-main", &selection, now).is_err());
    std::fs::remove_dir(root).unwrap();
}

#[test]
fn cancellation_keeps_worker_admission_until_actual_exit() {
    use sentinel_proto::selected_scan::{ScanErrorCode, ScanJobReference, ScanStartRequest};
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
    let request = ScanStartRequest {
        selection_ref: selected,
    };
    assert_eq!(
        jobs.start_wire("foreign", &request, now).unwrap_err().code,
        ScanErrorCode::SelectionUnavailable
    );
    let job = jobs
        .start_wire("trusted-main", &request, now)
        .unwrap()
        .job_ref;
    entered_rx.recv_timeout(Duration::from_secs(10)).unwrap();
    assert!(jobs.cancel("foreign", &job).is_err());
    assert_eq!(
        jobs.prepare_quarantine(
            "trusted-main",
            &sentinel_proto::quarantine_action::QuarantinePrepareRequest {
                job_ref: job.clone(),
                report_ref: "report_0".into()
            },
            Instant::now()
        )
        .unwrap_err()
        .code,
        sentinel_proto::quarantine_action::QuarantineErrorCode::Busy
    );
    let acknowledgment = jobs
        .cancel_wire(
            "trusted-main",
            &ScanJobReference {
                job_ref: job.clone(),
            },
        )
        .unwrap();
    assert_eq!(acknowledgment.job_ref, job);
    assert!(acknowledgment.cancellation_requested);
    assert_eq!(
        jobs.cancel_wire(
            "trusted-main",
            &ScanJobReference {
                job_ref: "C:/private/file".into()
            }
        )
        .unwrap_err()
        .code,
        ScanErrorCode::InvalidRequest
    );
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
