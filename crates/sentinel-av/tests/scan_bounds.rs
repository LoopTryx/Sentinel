use sentinel_av::engine::{scan_directory, Engine};

#[test]
fn huge_zero_file_is_inspected_with_visible_partial_padding_evidence() {
    let root = std::env::temp_dir().join(format!("sentinel-large-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("large.txt");
    std::fs::File::create(&path)
        .unwrap()
        .set_len(64 * 1024 * 1024)
        .unwrap();
    let report = Engine::new().scan_file(&path, &|_| None);
    assert!(
        report.sha256.is_empty(),
        "sampled bytes must not claim a full-file digest"
    );
    assert_ne!(report.verdict, "clean");
    assert!(report
        .detections
        .iter()
        .any(|finding| finding.name == "LargeZeroFilledRange"));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn executable_header_disguised_as_document_is_a_clue() {
    let root = std::env::temp_dir().join(format!("sentinel-header-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("invoice.pdf");
    let mut bytes = [0u8; 128];
    bytes[..2].copy_from_slice(b"MZ");
    bytes[60..64].copy_from_slice(&64u32.to_le_bytes());
    bytes[64..68].copy_from_slice(b"PE\0\0");
    std::fs::write(&path, bytes).unwrap();
    let report = Engine::new().scan_file(&path, &|_| None);
    assert_eq!(report.verdict, "suspicious");
    assert!(report
        .detections
        .iter()
        .any(|finding| finding.name == "DisguisedExecutableHeader"));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn directory_report_retention_is_bounded() {
    let root = std::env::temp_dir().join(format!("sentinel-wide-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    for index in 0..70 {
        std::fs::write(
            root.join(format!("{index}.txt")),
            b"ordinary harmless bytes",
        )
        .unwrap();
    }
    let reports = scan_directory(&Engine::new(), &root, &|_| None);
    assert!(
        reports.len() <= 65,
        "64 file reports plus one explicit limit report maximum"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn cancellation_before_access_and_expired_deadline_are_not_clean() {
    use std::time::{Duration, Instant};
    let engine = Engine::new();
    let missing =
        std::env::temp_dir().join(format!("sentinel-never-created-{}", uuid::Uuid::new_v4()));
    let report = engine.scan_file_with_control(
        &missing,
        &|_| None,
        &mut || true,
        &mut |_| panic!("no bytes should be acquired"),
        Instant::now() + Duration::from_secs(1),
    );
    assert_eq!(report.state, "cancelled");
    assert_eq!(report.verdict, "unknown");
    let report = engine.scan_file_with_control(
        &missing,
        &|_| None,
        &mut || false,
        &mut |_| panic!("no bytes should be acquired"),
        Instant::now(),
    );
    assert_eq!(report.state, "timed_out");
    assert!(report.sha256.is_empty());
}

#[test]
fn chunk_progress_can_cancel_and_closed_handle_allows_replacement() {
    use std::cell::Cell;
    use std::time::{Duration, Instant};
    let root = std::env::temp_dir().join(format!("sentinel-cancel-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("plain.txt");
    std::fs::write(&path, vec![b'A'; 1024 * 1024]).unwrap();
    let stop = Cell::new(false);
    let mut snapshots = Vec::new();
    let report = Engine::new().scan_file_with_control(
        &path,
        &|_| None,
        &mut || stop.get(),
        &mut |count| {
            snapshots.push(count);
            stop.set(true);
        },
        Instant::now() + Duration::from_secs(1),
    );
    assert_eq!(report.state, "cancelled");
    assert_eq!(snapshots, [65536]);
    assert!(report.sha256.is_empty());
    std::fs::write(&path, b"replacement after cancellation").unwrap();
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn same_engine_reentrant_scan_is_busy_and_admission_is_released() {
    use std::time::{Duration, Instant};
    let root = std::env::temp_dir().join(format!("sentinel-admission-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("plain.txt");
    std::fs::write(&path, b"ordinary harmless bytes").unwrap();
    let engine = Engine::new();
    let mut nested = Vec::new();
    let report = engine.scan_file_with_control(
        &path,
        &|_| None,
        &mut || false,
        &mut |_| nested.push(engine.scan_file(&path, &|_| None).state),
        Instant::now() + Duration::from_secs(1),
    );
    assert_eq!(report.state, "completed");
    assert_eq!(nested, ["busy"]);
    assert_eq!(engine.scan_file(&path, &|_| None).state, "completed");
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn directory_budget_counts_acquired_bytes_and_cancellation_stops_traversal() {
    use sentinel_av::engine::scan_directory_with_control;
    use std::cell::Cell;
    use std::collections::HashMap;
    use std::time::{Duration, Instant};
    let root = std::env::temp_dir().join(format!("sentinel-budget-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    for index in 0..10 {
        std::fs::File::create(root.join(format!("{index}.txt")))
            .unwrap()
            .set_len(8 * 1024 * 1024)
            .unwrap();
    }
    let engine = Engine::new();
    let mut counts = HashMap::new();
    let reports = scan_directory_with_control(
        &engine,
        &root,
        &|_| None,
        &mut || false,
        &mut |path, count| {
            counts.insert(path.to_path_buf(), count);
        },
        // Exercise the byte budget with the production maximum deadline. A
        // five-second deadline can legitimately time out first on cold CI.
        Instant::now() + Duration::from_secs(30),
    );
    assert_eq!(counts.values().sum::<u64>(), 64 * 1024 * 1024);
    assert_eq!(reports.last().unwrap().state, "limit_reached");
    let stop = Cell::new(false);
    let reports = scan_directory_with_control(
        &engine,
        &root,
        &|_| None,
        &mut || stop.get(),
        &mut |_, _| stop.set(true),
        Instant::now() + Duration::from_secs(1),
    );
    assert_eq!(reports.last().unwrap().state, "cancelled");
    assert_eq!(reports.len(), 2);
    std::fs::remove_dir_all(root).unwrap();
}
