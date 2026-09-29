use shield_proto::assessment::{Assessment, Coverage, Risk};
use shield_proto::capability::{CapabilityState, CapabilityStatus};
use shield_proto::jobs::{Job, JobState};
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
