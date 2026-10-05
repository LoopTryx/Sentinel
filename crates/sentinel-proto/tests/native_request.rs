use sentinel_proto::native_request::{NativeRequest, NativeRequestErrorCode, validate_request};
#[test]
fn only_allowlisted_requests_pass_and_urls_are_local_data() {
    assert!(matches!(validate_request(br#"{"version":{"major":1,"minor":0},"id":"request-1","kind":"capabilities.list","payload":{}}"#).unwrap(),NativeRequest::Capabilities{..}));
    assert!(matches!(validate_request(br#"{"version":{"major":1,"minor":0},"id":"request-2","kind":"url.assess","payload":{"url":"https://example.test/page","subjectRef":"subject-1"}}"#).unwrap(),NativeRequest::Url{..}));
}
#[test]
fn malformed_authority_fields_never_supply_trusted_id() {
    for raw in [
        r#"{"version":{"major":1,"minor":0},"id":"private token","kind":"capabilities.list","payload":{}}"#,
        r#"{"version":{"major":1,"minor":0},"id":"ok","kind":"capabilities.list","payload":{},"execute":"x"}"#,
        r#"{"version":{"major":1,"minor":0},"id":"a","id":"b","kind":"capabilities.list","payload":{}}"#,
    ] {
        let err = validate_request(raw.as_bytes()).unwrap_err();
        assert_eq!(err.id, None);
    }
}
#[test]
fn duplicate_url_fields_and_debug_output_cannot_leak_or_select_secret() {
    let raw=br#"{"version":{"major":1,"minor":0},"id":"r-1","kind":"url.assess","payload":{"url":"https://example.test/","url":"https://private.test/secret","subjectRef":"s-1"}}"#;
    assert!(validate_request(raw).is_err());
    let raw=br#"{"version":{"major":1,"minor":0},"id":"r-1","kind":"url.assess","payload":{"url":"https://example.test/private-token","subjectRef":"s-1"}}"#;
    assert!(!format!("{:?}", validate_request(raw).unwrap()).contains("private-token"));
}
#[test]
fn unsupported_envelopes_have_only_validated_correlation() {
    let e = validate_request(
        br#"{"version":{"major":1,"minor":0},"id":"r-1","kind":"vault.unlock","payload":{}}"#,
    )
    .unwrap_err();
    assert_eq!(e.code, NativeRequestErrorCode::UnsupportedMethod);
    assert_eq!(e.id.as_deref(), Some("r-1"));
    let e = validate_request(
        br#"{"version":{"major":1,"minor":1},"id":"r-1","kind":"capabilities.list","payload":{}}"#,
    )
    .unwrap_err();
    assert_eq!(e.code, NativeRequestErrorCode::UnsupportedVersion);
}
#[test]
fn url_credentials_controls_bounds_and_private_fields_fail_closed() {
    for url in [
        "file:///x",
        "https://user:secret@example.test/",
        "https://example.test/\n",
        "http:/example.test",
        "https://example.test\\x",
        &format!("https://example.test/{}", "x".repeat(2048)),
    ] {
        let raw = serde_json::json!({"version":{"major":1,"minor":0},"id":"r-1","kind":"url.assess","payload":{"url":url,"subjectRef":"s-1"}});
        let e = validate_request(&serde_json::to_vec(&raw).unwrap()).unwrap_err();
        assert_eq!(e.id, None);
    }
    let e = validate_request(&vec![b' '; 1_048_577]).unwrap_err();
    assert_eq!(e.code, NativeRequestErrorCode::Oversized);
    assert_eq!(e.id, None);
}
