use sentinel_scan::{
    dispatch::{DispatchError, NativeScanDispatcher, NativeScanReport},
    selection::{NativeSelectionRegistry, SelectionKind},
};
use std::{
    fs,
    time::{Duration, Instant},
};

#[test]
fn actual_benign_dispatch_correlates_file_folder_and_rejects_stale_actions() {
    let root = std::env::temp_dir().join(format!("sentinel-dispatch-{}", std::process::id()));
    fs::create_dir(&root).unwrap();
    let file = root.join("benign.txt");
    fs::write(&file, b"harmless sample").unwrap();
    let mut registry = NativeSelectionRegistry::new();
    let reference = registry
        .register_native_selection(file, SelectionKind::File)
        .unwrap();
    let mut dispatcher = NativeScanDispatcher::new();
    assert_eq!(
        dispatcher
            .start(&registry, &reference, Duration::ZERO)
            .unwrap_err(),
        DispatchError::InvalidDeadline
    );
    assert_eq!(
        dispatcher
            .start(&registry, "stale", Duration::from_secs(2))
            .unwrap_err(),
        DispatchError::InvalidSelection
    );
    let ticket = dispatcher
        .start(&registry, &reference, Duration::from_secs(2))
        .unwrap();
    assert_eq!(
        dispatcher
            .start(&registry, &reference, Duration::from_secs(2))
            .unwrap_err(),
        DispatchError::Busy
    );
    let mut wrong = ticket.clone();
    wrong.job_id.push('x');
    assert_eq!(
        dispatcher.poll(&wrong).unwrap_err(),
        DispatchError::WrongOperation
    );
    assert!(!dispatcher.cancel(&wrong));
    let response =
        sentinel_scan::dispatch_wire::poll_current_response(&mut dispatcher, &registry, &wrong);
    let json = serde_json::to_value(response).unwrap();
    assert_eq!(json["status"], "error");
    assert_eq!(json["data"], "wrong_operation");
    assert!(!dispatcher.clear_returned(&ticket));
    let start = Instant::now();
    let snapshot = loop {
        let s = dispatcher.poll_current(&registry, &ticket).unwrap();
        if s.worker_returned {
            break s;
        }
        assert!(start.elapsed() < Duration::from_secs(5));
        std::thread::yield_now();
    };
    let wire = sentinel_scan::dispatch_wire::dispatch_snapshot(&ticket, &snapshot).unwrap();
    let response =
        sentinel_scan::dispatch_wire::poll_current_response(&mut dispatcher, &registry, &ticket);
    let json = serde_json::to_value(response).unwrap();
    assert_eq!(json["status"], "snapshot");
    assert_eq!(json["data"]["ticket"]["jobId"], ticket.job_id);
    assert_eq!(
        serde_json::to_value(&wire).unwrap()["report"]["kind"],
        "file"
    );
    match snapshot.report.unwrap() {
        NativeScanReport::File(r) => {
            assert_eq!(r.files_checked, 1);
            assert_eq!(r.bytes_read, 15);
            assert_eq!(r.job_id, ticket.job_id);
            assert_eq!(r.selection_ref, reference);
        }
        _ => panic!("wrong report"),
    }
    assert!(dispatcher.clear_returned(&ticket));
    let reference = registry
        .register_native_selection(root.clone(), SelectionKind::Directory)
        .unwrap();
    let folder = dispatcher
        .start(&registry, &reference, Duration::from_secs(2))
        .unwrap();
    assert_eq!(
        dispatcher.poll(&ticket).unwrap_err(),
        DispatchError::WrongOperation
    );
    let start = Instant::now();
    let snapshot = loop {
        let s = dispatcher.poll_current(&registry, &folder).unwrap();
        if s.worker_returned {
            break s;
        }
        assert!(start.elapsed() < Duration::from_secs(5));
        std::thread::yield_now();
    };
    let wire = sentinel_scan::dispatch_wire::dispatch_snapshot(&folder, &snapshot).unwrap();
    assert_eq!(
        serde_json::to_value(&wire).unwrap()["report"]["kind"],
        "directory"
    );
    let progress = snapshot.progress.unwrap();
    match snapshot.report.unwrap() {
        NativeScanReport::Directory(r) => {
            assert_eq!(r.progress, progress.progress);
            assert_eq!(r.progress.files_checked, 1);
            assert_eq!(r.selection_ref, reference);
        }
        _ => panic!("wrong report"),
    }
    assert!(
        registry
            .register_native_selection("relative-invalid".into(), SelectionKind::File)
            .is_err()
    );
    let stale = dispatcher.poll_current(&registry, &folder).unwrap();
    assert!(stale.abandoned && stale.worker_returned);
    assert!(stale.report.is_none() && stale.progress.is_none());
    let wire = sentinel_scan::dispatch_wire::dispatch_snapshot(&folder, &stale).unwrap();
    assert!(wire.abandoned && wire.report.is_none() && wire.progress.is_none());
    registry
        .register_native_selection(root.clone(), SelectionKind::Directory)
        .unwrap();
    let wrong = dispatcher.poll_current(&registry, &ticket).unwrap_err();
    assert_eq!(wrong, DispatchError::WrongOperation);
    // Suppression stays sealed, including when later low-level polling occurs.
    assert!(dispatcher.poll(&folder).unwrap().report.is_none());
    assert!(dispatcher.clear_returned(&folder));
    fs::remove_file(root.join("benign.txt")).unwrap();
    fs::remove_dir(root).unwrap();
}
