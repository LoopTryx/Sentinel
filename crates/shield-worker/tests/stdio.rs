use shield_proto::rpc::decode_frame;
use shield_scan::pipeline::ScanState;
use shield_worker::{WORKER_PROTOCOL, WorkerResponse};
use std::io::Write;
use std::process::{Command, Stdio};

#[test]
fn worker_scans_only_inherited_stdin_and_returns_bounded_report() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_shield-worker"))
        .arg("--scan-stdin")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(b"benign worker fixture")
        .unwrap();
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    let response: WorkerResponse =
        serde_json::from_slice(decode_frame(&output.stdout).unwrap()).unwrap();
    assert_eq!(response.version, WORKER_PROTOCOL);
    assert_eq!(response.report.state, ScanState::NoKnownFinding);
    assert_eq!(response.report.files_checked, 1);
    assert!(!response.report.full_signature_engine_active);
}

#[test]
fn worker_rejects_unknown_mode() {
    let output = Command::new(env!("CARGO_BIN_EXE_shield-worker"))
        .arg("--read-path")
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(output.stdout.is_empty());
}
