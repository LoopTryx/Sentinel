use sentinel_proto::password_reuse::{PasswordReuseAuditError, audit_password_reuse};

#[test]
fn exact_reuse_groups_are_ordered_and_do_not_expose_invented_inputs() {
    let report = audit_password_reuse(&[
        "invented-A!",
        "invented-B!",
        "invented-A!",
        "unique!",
        "invented-B!",
        "invented-A!",
    ])
    .unwrap();
    assert_eq!(report.checked_items, 6);
    assert_eq!(report.reused_groups, vec![vec![0, 2, 5], vec![1, 4]]);
    let json = serde_json::to_string(&report).unwrap();
    assert_eq!(json, r#"{"checkedItems":6,"reusedGroups":[[0,2,5],[1,4]]}"#);
    let debug = format!("{report:?}");
    for secret in ["invented-A!", "invented-B!", "unique!"] {
        assert!(!json.contains(secret));
        assert!(!debug.contains(secret));
    }
}

#[test]
fn equality_is_exact_without_case_whitespace_or_unicode_normalization() {
    let report = audit_password_reuse(&["a", "A", "a ", " a", "é", "e\u{301}", "é"]).unwrap();
    assert_eq!(report.reused_groups, vec![vec![4, 6]]);
    assert_eq!(report.checked_items, 7);
    assert!(audit_password_reuse(&[]).unwrap().reused_groups.is_empty());
    assert!(
        audit_password_reuse(&["x"])
            .unwrap()
            .reused_groups
            .is_empty()
    );
}

#[test]
fn bounds_reject_the_whole_batch_without_partial_or_secret_error_data() {
    assert_eq!(
        audit_password_reuse(&vec!["x"; 129]),
        Err(PasswordReuseAuditError::TooManyItems)
    );
    assert_eq!(
        audit_password_reuse(&["valid", ""]),
        Err(PasswordReuseAuditError::EmptyPassword)
    );
    let oversized = "界".repeat(342);
    assert_eq!(
        audit_password_reuse(&["valid", &oversized]),
        Err(PasswordReuseAuditError::PasswordTooLong)
    );
    let at_limit = "x".repeat(1024);
    let report = audit_password_reuse(&vec![at_limit.as_str(); 128]).unwrap();
    assert_eq!(report.checked_items, 128);
    assert_eq!(report.reused_groups, vec![(0u16..128).collect::<Vec<_>>()]);
    assert_eq!(
        serde_json::to_string(&PasswordReuseAuditError::PasswordTooLong).unwrap(),
        "\"password_too_long\""
    );
}
