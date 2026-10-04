use sentinel_scan::selection::{NativeSelectionRegistry, SelectionKind};
use std::path::PathBuf;

#[test]
fn selected_benign_file_scans_and_report_contains_no_private_path() {
    use sentinel_scan::{
        pipeline::{ScanLimits, ScanState, scan_file},
        report::selected_file_report,
    };
    let path = std::env::temp_dir().join(format!(
        "sentinel-private-selection-{}.txt",
        std::process::id()
    ));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .unwrap();
    use std::io::Write;
    file.write_all(b"harmless selected bytes").unwrap();
    drop(file);
    let mut registry = NativeSelectionRegistry::new();
    let reference = registry
        .register_native_selection(path.clone(), SelectionKind::File)
        .unwrap();
    let selection = registry.resolve(&reference).unwrap();
    let result = scan_file(selection.path(), ScanLimits::default());
    assert_eq!(result.state, ScanState::NoKnownFinding);
    assert_eq!(result.files_checked, 1);
    let report = selected_file_report(&result, "job-benign", &reference).unwrap();
    let json = serde_json::to_string(&report).unwrap();
    assert!(!json.contains("sentinel-private-selection"));
    registry.clear();
    assert!(registry.resolve(&reference).is_none());
    std::fs::remove_file(path).unwrap();
}

#[test]
fn replacement_clear_and_other_registry_reject_old_references() {
    let mut registry = NativeSelectionRegistry::new();
    let first = registry
        .register_native_selection(std::env::temp_dir(), SelectionKind::Directory)
        .unwrap();
    assert!(registry.resolve(&first).is_some());
    let mut other = NativeSelectionRegistry::new();
    let other_ref = other
        .register_native_selection(std::env::temp_dir(), SelectionKind::Directory)
        .unwrap();
    assert_ne!(first, other_ref);
    assert!(registry.resolve(&other_ref).is_none());
    let second = registry
        .register_native_selection(std::env::temp_dir(), SelectionKind::Directory)
        .unwrap();
    assert_ne!(first, second);
    assert!(registry.resolve(&first).is_none());
    registry.clear();
    assert!(registry.resolve(&second).is_none());
}

#[test]
fn rejected_path_invalidates_previous_selection_and_diagnostics_hide_paths() {
    let mut registry = NativeSelectionRegistry::new();
    let private_path = std::env::temp_dir().join("private-owner-filename.txt");
    let selected = registry
        .register_native_selection(private_path.clone(), SelectionKind::File)
        .unwrap();
    assert!(!format!("{registry:?}").contains("private-owner-filename"));
    let approved = registry.resolve(&selected).unwrap();
    assert_eq!(approved.path(), private_path);
    assert_eq!(approved.kind(), SelectionKind::File);
    assert!(!format!("{approved:?}").contains("private-owner-filename"));
    let error = registry
        .register_native_selection(PathBuf::from("relative-secret.txt"), SelectionKind::File)
        .unwrap_err();
    assert_eq!(error.to_string(), "invalid native selection");
    assert!(registry.resolve(&selected).is_none());
    assert!(registry.resolve("C:\\private-owner-filename.txt").is_none());
}
