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
    assert!(!dispatcher.clear_returned(&ticket));
    let start = Instant::now();
    let snapshot = loop {
        let s = dispatcher.poll(&ticket).unwrap();
        if s.worker_returned {
            break s;
        }
        assert!(start.elapsed() < Duration::from_secs(5));
        std::thread::yield_now();
    };
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
        let s = dispatcher.poll(&folder).unwrap();
        if s.worker_returned {
            break s;
        }
        assert!(start.elapsed() < Duration::from_secs(5));
        std::thread::yield_now();
    };
    let progress = snapshot.progress.unwrap();
    match snapshot.report.unwrap() {
        NativeScanReport::Directory(r) => {
            assert_eq!(r.progress, progress.progress);
            assert_eq!(r.progress.files_checked, 1);
            assert_eq!(r.selection_ref, reference);
        }
        _ => panic!("wrong report"),
    }
    assert!(dispatcher.clear_returned(&folder));
    fs::remove_file(root.join("benign.txt")).unwrap();
    fs::remove_dir(root).unwrap();
}
