use sentinel_intel::providers::MAX_URL_BYTES;
use sentinel_intel::url_explanation::explain_url;
use sentinel_proto::assessment::{Confidence, Coverage, Risk};
use sentinel_proto::url_explanation::{UrlExplanationError, UrlReason};

#[test]
fn exact_byte_budget_is_accepted_but_one_more_byte_is_rejected() {
    let prefix = "https://example.test/";
    let allowed = format!("{prefix}{}", "a".repeat(MAX_URL_BYTES - prefix.len()));
    assert!(explain_url(&allowed).is_ok());
    assert_eq!(
        explain_url(&(allowed + "a")),
        Err(UrlExplanationError::TooLong)
    );
}

#[test]
fn structured_errors_do_not_store_rejected_input() {
    for (input, expected) in [
        ("file:///secret", UrlExplanationError::UnsupportedScheme),
        ("https:///secret", UrlExplanationError::InvalidUrl),
        (
            "https://secret.test/\n",
            UrlExplanationError::AmbiguousInput,
        ),
        (
            "https://secret.test:99999/",
            UrlExplanationError::InvalidUrl,
        ),
    ] {
        assert_eq!(explain_url(input), Err(expected.clone()));
        assert!(!serde_json::to_string(&expected).unwrap().contains("secret"));
    }
}

#[test]
fn equivalent_hosts_are_canonical_without_ignoring_credentials() {
    let plain = explain_url("HTTPS://EXAMPLE.TEST:443/").unwrap();
    let escaped = explain_url("https://%65xample.test/").unwrap();
    assert_eq!(plain, escaped);
    assert_eq!(plain.port, 443);
    assert!(plain.reasons.is_empty());
    let userinfo = explain_url("https://@example.test/").unwrap();
    assert_eq!(userinfo.reasons, vec![UrlReason::EmbeddedCredentials]);
}

#[test]
fn localhost_and_private_addresses_never_trigger_probes_or_healthy_verdicts() {
    for input in [
        "https://localhost/",
        "https://[::1]/",
        "https://10.0.0.1/",
        "https://2130706433/",
    ] {
        let result = explain_url(input).unwrap();
        assert!(!result.network_accessed);
        assert!(!result.reputation_checked);
        assert_eq!(result.coverage, Coverage::Partial);
        assert_eq!(result.confidence, Confidence::Low);
        assert!(matches!(result.risk, Risk::Unknown | Risk::Suspicious));
        assert!(result.registrable_domain.is_none());
    }
    assert_eq!(
        explain_url("https://2130706433/").unwrap().host_ascii,
        "127.0.0.1"
    );
}

#[test]
fn hostname_substrings_do_not_pretend_to_be_a_registrable_domain() {
    let result = explain_url("https://bank.test.evil.test/").unwrap();
    assert_eq!(result.host_ascii, "bank.test.evil.test");
    assert!(result.registrable_domain.is_none());
    assert_eq!(result.risk, Risk::Unknown);
}

#[test]
fn all_controls_and_direction_overrides_are_rejected_before_url_normalization() {
    for c in [
        '\0', '\t', '\r', '\n', '\u{7f}', '\u{85}', '\u{200b}', '\u{202e}', '\u{2066}', '\u{feff}',
    ] {
        assert_eq!(
            explain_url(&format!("https://example.test/{c}")),
            Err(UrlExplanationError::AmbiguousInput)
        );
    }
}
