use sentinel_proto::assessment::{Assessment, Coverage, Risk};
use sentinel_proto::capability::{CapabilityState, CapabilityStatus};
use sentinel_proto::jobs::{Job, JobState};
use std::path::PathBuf;
use std::process::Command;

#[test]
fn fixture_command_reports_unavailable_protection() {
    let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
        .args(["status", "--fixture"])
        .output()
        .unwrap();
    assert!(output.status.success());
    let status: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    let assessment: Assessment = serde_json::from_value(status["assessment"].clone()).unwrap();
    let capabilities: Vec<CapabilityStatus> =
        serde_json::from_value(status["capabilities"].clone()).unwrap();
    let job: Job = serde_json::from_value(status["job"].clone()).unwrap();
    assert_eq!(assessment.risk, Risk::Unknown);
    assert_eq!(assessment.coverage, Coverage::Unavailable);
    assert!(
        capabilities
            .iter()
            .any(|c| c.state == CapabilityState::Untested)
    );
    assert_eq!(status["mode"], "fixture");
    assert_eq!(job.id, "fixture-job-1");
    assert_eq!(job.state, JobState::Queued);
}

#[test]
fn no_arguments_cannot_claim_a_live_status() {
    let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
        .output()
        .unwrap();
    assert!(!output.status.success());
}

#[test]
fn local_file_scan_reports_partial_coverage_and_checked_count() {
    let path = std::env::temp_dir().join(format!("sentinel-cli-scan-{}.txt", std::process::id()));
    std::fs::write(&path, b"benign CLI fixture").unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
        .args(["scan", "file", path.to_str().unwrap()])
        .output()
        .unwrap();
    std::fs::remove_file(path).unwrap();
    assert!(output.status.success());
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["mode"], "local_read_only_preview");
    assert_eq!(report["coverage"], "partial");
    assert_eq!(report["result"]["filesChecked"], 1);
    assert_eq!(report["result"]["fullSignatureEngineActive"], false);
}

#[test]
fn local_directory_scan_reports_actual_counts_and_partial_coverage() {
    let path = std::env::temp_dir().join(format!("sentinel-cli-directory-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&path);
    std::fs::create_dir_all(&path).unwrap();
    std::fs::write(path.join("one.txt"), b"one").unwrap();
    std::fs::write(path.join("two.txt"), b"two").unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
        .args(["scan", "directory", path.to_str().unwrap()])
        .output()
        .unwrap();
    std::fs::remove_dir_all(path).unwrap();
    assert!(output.status.success());
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["profile"], "custom_directory");
    assert_eq!(report["coverage"], "partial");
    assert_eq!(report["result"]["filesVisited"], 2);
    assert_eq!(report["result"]["filesChecked"], 2);
    assert_eq!(report["result"]["complete"], true);
}

#[test]
fn local_feed_import_and_offline_lookup_report_listing_without_safety_claim() {
    let cache_dir = std::env::temp_dir().join(format!("sentinel-cli-intel-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&cache_dir);
    let feed_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../data/fixtures/feeds/urlhaus-sample.txt");
    let imported = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
        .args([
            "intel",
            "import-local",
            feed_path.to_str().unwrap(),
            cache_dir.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert!(
        imported.status.success(),
        "{}",
        String::from_utf8_lossy(&imported.stderr)
    );
    let listed = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
        .args([
            "intel",
            "lookup-offline",
            cache_dir.to_str().unwrap(),
            "https://malware.test/payload.exe",
        ])
        .output()
        .unwrap();
    assert!(listed.status.success());
    let listed: serde_json::Value = serde_json::from_slice(&listed.stdout).unwrap();
    assert_eq!(listed["verdict"], "listed");
    assert_eq!(listed["provider"], "urlhaus");
    let absent = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
        .args([
            "intel",
            "lookup-offline",
            cache_dir.to_str().unwrap(),
            "https://other.test/",
        ])
        .output()
        .unwrap();
    let absent: serde_json::Value = serde_json::from_slice(&absent.stdout).unwrap();
    assert_eq!(absent["verdict"], "not_listed");
    std::fs::remove_dir_all(cache_dir).unwrap();
}
