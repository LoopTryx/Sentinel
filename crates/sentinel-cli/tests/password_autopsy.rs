use std::process::Command;

#[test]
fn synthetic_password_lesson_has_closed_answers_and_no_safety_guarantee() {
    for (id, choice) in [
        ("predictable", "replace_predictable"),
        ("reused", "make_unique"),
        ("unique_generated", "keep_unique"),
    ] {
        let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
            .args(["academy", "password-autopsy", id, choice])
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let result: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(result["mode"], "synthetic_lesson");
        assert_eq!(result["correct"], true);
        assert_eq!(result["protectionVerdict"], false);
        assert_eq!(result["realCredentialsAccepted"], false);
        assert_eq!(result["networkAccessed"], false);
        assert!(result.get("password").is_none());
    }
}

#[test]
fn invalid_input_is_rejected_without_echoing_secrets() {
    for value in ["private-password", "", "../../private", "secret\nvalue"] {
        let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
            .args(["academy", "password-autopsy", value, "keep_unique"])
            .output()
            .unwrap();
        assert!(!output.status.success());
        assert!(output.stdout.is_empty());
        assert!(!String::from_utf8_lossy(&output.stderr).contains("private-password"));
    }
}

#[test]
fn wrong_choice_is_feedback_not_completed_learning() {
    let output = Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
        .args(["academy", "password-autopsy", "reused", "keep_unique"])
        .output()
        .unwrap();
    assert!(output.status.success());
    let result: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(result["correct"], false);
}
