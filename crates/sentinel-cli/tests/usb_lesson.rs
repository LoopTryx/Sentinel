use std::process::Command;
#[test]
fn usb_lesson_cli_lists_labeled_pack_and_evaluates() {
    let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
        .args(["academy", "usb", "list"])
        .output()
        .unwrap();
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    let pack: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(pack.as_array().unwrap().len(), 3);
    for (id, scope, correct) in [
        ("composite-device", "selected_file_bytes", true),
        ("composite-device", "input_behavior", false),
        ("keyboard-only", "nothing_measured", true),
        ("keyboard-only", "firmware_safety", false),
    ] {
        let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
            .args(["academy", "usb", "evaluate", id, scope])
            .output()
            .unwrap();
        assert!(output.status.success());
        assert!(output.stderr.is_empty());
        let feedback: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(feedback["synthetic"], true);
        assert_eq!(feedback["correct"], correct);
        assert_eq!(feedback["scenarioId"], id);
    }
}
#[test]
fn errors_are_fixed_and_never_echo_private_arguments() {
    for (id, scope, code) in [
        ("missing", "input_behavior", "unknown_scenario"),
        ("private-input!", "firmware_safety", "invalid_scenario_id"),
        ("selected-storage", "private-choice!", "invalid_scope"),
    ] {
        let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
            .args(["academy", "usb", "evaluate", id, scope])
            .output()
            .unwrap();
        assert!(!output.status.success());
        assert!(output.stdout.is_empty());
        assert_eq!(String::from_utf8(output.stderr).unwrap().trim(), code);
    }
}
