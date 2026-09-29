use shield_proto::assessment::{Assessment, Coverage, Risk};
use shield_proto::capability::{CapabilityState, CapabilityStatus};
use shield_proto::jobs::{Job, JobState};
use std::path::PathBuf;
use std::process::Command;

#[test]
fn fixture_command_reports_unavailable_protection() {
    let output = Command::new(env!("CARGO_BIN_EXE_shield-cli"))
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
    let output = Command::new(env!("CARGO_BIN_EXE_shield-cli"))
        .output()
        .unwrap();
    assert!(!output.status.success());
}

#[test]
fn local_feed_import_and_offline_lookup_report_listing_without_safety_claim() {
    let cache_dir =
        std::env::temp_dir().join(format!("cybershield-cli-intel-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&cache_dir);
    let feed_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../data/fixtures/feeds/urlhaus-sample.txt");
    let imported = Command::new(env!("CARGO_BIN_EXE_shield-cli"))
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
    let listed = Command::new(env!("CARGO_BIN_EXE_shield-cli"))
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
    let absent = Command::new(env!("CARGO_BIN_EXE_shield-cli"))
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
