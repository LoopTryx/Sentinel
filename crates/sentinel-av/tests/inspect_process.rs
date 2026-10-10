#![cfg(windows)]

use std::process::{Command, Stdio};

#[test]
fn selected_owned_file_emits_real_path_free_inspection() {
    let root = std::env::temp_dir().join(format!("sentinel-process-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let path = root.join("private-clean-name.txt");
    std::fs::write(&path, b"ordinary harmless content").unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_sentinel-inspect"))
        .arg("--file")
        .arg(&path)
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(output.status.success());
    let text = String::from_utf8(output.stdout).unwrap();
    assert!(!text.contains("private-clean-name"));
    let final_line = text.lines().last().unwrap();
    let snapshot: sentinel_proto::selected_scan::ScanJobSnapshot =
        serde_json::from_str(final_line).unwrap();
    snapshot.validate().unwrap();
    assert_eq!(snapshot.reports.len(), 1);
    assert_eq!(snapshot.reports[0].inspected_bytes, "25");
    assert!(snapshot.reports[0].sha256.is_some());
    assert_eq!(std::fs::read(&path).unwrap(), b"ordinary harmless content");
    std::fs::remove_file(path).unwrap();
    std::fs::remove_dir(root).unwrap();
}

#[test]
fn protected_drive_is_refused_without_path_disclosure() {
    let output = Command::new(env!("CARGO_BIN_EXE_sentinel-inspect"))
        .args(["--file", "E:\\not-accessed.txt"])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert_eq!(
        String::from_utf8(output.stdout).unwrap().trim(),
        "{\"error\":\"inspection_unavailable\"}"
    );
    assert!(output.stderr.is_empty());
}
