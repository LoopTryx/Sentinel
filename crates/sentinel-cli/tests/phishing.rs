use std::process::Command;

#[test]
fn scenario_pack_and_all_choices_run_offline_through_cli() {
    let listing = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
        .args(["academy", "phishing", "list"])
        .output()
        .unwrap();
    assert!(listing.status.success());
    assert!(listing.stderr.is_empty());
    let pack: serde_json::Value = serde_json::from_slice(&listing.stdout).unwrap();
    assert_eq!(pack.as_array().unwrap().len(), 3);
    for choice in ["follow_request", "verify_separately", "ignore"] {
        let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
            .args(["academy", "phishing", "evaluate", "otp-request", choice])
            .output()
            .unwrap();
        assert!(output.status.success());
        assert!(output.stderr.is_empty());
        let feedback: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(feedback["synthetic"], true);
        assert_eq!(feedback["correct"], choice == "verify_separately");
    }
}

#[test]
fn cli_errors_are_typed_and_do_not_echo_arbitrary_input() {
    for (id, choice, expected) in [
        ("made-up", "ignore", "unknown_scenario"),
        ("private-input!", "ignore", "invalid_scenario_id"),
        ("otp-request", "private-choice!", "invalid_choice"),
    ] {
        let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
            .args(["academy", "phishing", "evaluate", id, choice])
            .output()
            .unwrap();
        assert!(!output.status.success());
        assert!(output.stdout.is_empty());
        assert_eq!(String::from_utf8(output.stderr).unwrap().trim(), expected);
    }
}
