use std::process::Command;

fn explain(input: &str) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_sentinel-cli"))
        .args(["url", "explain-local", input])
        .output()
        .unwrap()
}

#[test]
fn https_without_warning_signs_stays_unknown_and_partial() {
    let output = explain("https://Example.TEST/account?secret=do-not-echo#private");
    assert!(output.status.success(), "{:?}", output);
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["hostAscii"], "example.test");
    assert_eq!(report["risk"], "unknown");
    assert_eq!(report["coverage"], "partial");
    assert_eq!(report["networkAccessed"], false);
    assert_eq!(report["reputationChecked"], false);
    assert_eq!(report["registrableDomain"], serde_json::Value::Null);
    let json = String::from_utf8(output.stdout).unwrap();
    for secret in ["account", "secret", "do-not-echo", "private"] {
        assert!(!json.contains(secret));
    }
}

#[test]
fn userinfo_does_not_disguise_the_actual_destination_or_escape_into_output() {
    let output = explain("https://trusted.test:private-password@evil.test:8443/login");
    assert!(output.status.success());
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["hostAscii"], "evil.test");
    assert_eq!(report["risk"], "suspicious");
    assert!(
        report["reasons"]
            .as_array()
            .unwrap()
            .contains(&serde_json::json!("embedded_credentials"))
    );
    assert!(
        report["reasons"]
            .as_array()
            .unwrap()
            .contains(&serde_json::json!("unusual_port"))
    );
    let json = String::from_utf8(output.stdout).unwrap();
    assert!(!json.contains("private-password"));
    assert!(!json.contains("trusted.test"));
}

#[test]
fn unicode_host_is_canonical_ascii_with_a_review_reason() {
    let output = explain("https://bücher.test/");
    assert!(output.status.success());
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["hostAscii"], "xn--bcher-kva.test");
    assert!(
        report["reasons"]
            .as_array()
            .unwrap()
            .contains(&serde_json::json!("internationalized_host"))
    );
}

#[test]
fn ip_and_http_are_observations_not_a_malware_verdict() {
    let output = explain("http://127.0.0.1/");
    assert!(output.status.success());
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["hostAscii"], "127.0.0.1");
    assert_eq!(
        report["reasons"],
        serde_json::json!(["unencrypted_http", "ip_literal"])
    );
    assert_eq!(report["confidence"], "low");
}

#[test]
fn ambiguous_or_unsupported_input_fails_without_echoing_it() {
    for input in [
        "https://good.test\\@evil.test/",
        "https://example.test/a b",
        "https://example.test/\nprivate",
        "file:///private",
        "javascript:private()",
        "example.test",
        "https:example.test",
        "https:///example.test",
        "https://example.test/\u{202e}private",
    ] {
        let output = explain(input);
        assert!(!output.status.success(), "accepted {input:?}");
        assert!(output.stdout.is_empty());
        assert!(
            !String::from_utf8(output.stderr)
                .unwrap()
                .contains("private")
        );
    }
}

#[test]
fn byte_budget_rejects_large_ascii_and_multibyte_inputs() {
    for input in [
        format!("https://example.test/{}", "a".repeat(2048)),
        format!("https://example.test/{}", "é".repeat(1024)),
    ] {
        let output = explain(&input);
        assert!(!output.status.success());
        assert!(output.stdout.is_empty());
    }
}
