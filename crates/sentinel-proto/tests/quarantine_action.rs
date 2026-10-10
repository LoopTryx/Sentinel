use sentinel_proto::quarantine_action::*;

#[test]
fn requests_refuse_paths_owner_confirmation_and_noncanonical_report_refs() {
    for index in [0, 64] {
        assert!(
            QuarantinePrepareRequest {
                job_ref: "job_1".into(),
                report_ref: format!("report_{index}")
            }
            .validate()
            .is_ok()
        );
    }
    for report in [
        "report_00",
        "report_65",
        "report_-1",
        "report_+1",
        "report_",
        "report_18446744073709551616",
        "C:\\private",
    ] {
        assert!(
            QuarantinePrepareRequest {
                job_ref: "job_1".into(),
                report_ref: report.into()
            }
            .validate()
            .is_err()
        );
    }
    assert!(
        QuarantinePrepareRequest {
            job_ref: "C:\\private".into(),
            report_ref: "report_0".into()
        }
        .validate()
        .is_err()
    );
    for json in [
        r#"{"jobRef":"j","reportRef":"report_0","path":"private"}"#,
        r#"{"jobRef":"j","reportRef":"report_0","owner":"caller"}"#,
    ] {
        assert!(serde_json::from_str::<QuarantinePrepareRequest>(json).is_err());
    }
    assert!(
        serde_json::from_str::<QuarantineActionReference>(r#"{"actionRef":"a","approved":true}"#)
            .is_err()
    );
    assert!(
        serde_json::from_str::<QuarantineActionReference>(r#"{"actionRef":"a","now":0}"#).is_err()
    );
}

fn preview() -> QuarantinePreview {
    QuarantinePreview {
        action_ref: "action_1".into(), selection_ref: "selection_1".into(), job_ref: "job_1".into(), report_ref: "report_0".into(), expires_after_seconds: 30,
        inspection: serde_json::from_value(serde_json::json!({"reportRef":"report_0","state":"completed","verdict":"none_observed","coverage":"partial","logicalBytes":"5","inspectedBytes":"5","sha256":"a".repeat(64),"evidence":{"zeroBytes":"0","zeroPermille":0,"rangeComplete":true,"peHeaderPresent":false},"findings":[]})).unwrap(),
    }
}

#[test]
fn preview_requires_matching_complete_evidence_and_bounded_lifetime() {
    assert!(preview().validate().is_ok());
    let mut mismatched = preview();
    mismatched.inspection.report_ref = "report_1".into();
    assert!(mismatched.validate().is_err());
    let mut expiry = preview();
    expiry.expires_after_seconds = 31;
    assert!(expiry.validate().is_err());
    let mut partial = preview();
    partial.inspection.state = sentinel_proto::file_inspection::FileInspectionState::Partial;
    assert!(partial.validate().is_err());
    let mut missing_digest = preview();
    missing_digest.inspection.sha256 = None;
    assert!(missing_digest.validate().is_err());
}

#[test]
fn receipt_keeps_original_retained_distinct_and_refs_closed() {
    let mut receipt = QuarantineReceipt {
        action_ref: "action_1".into(),
        selection_ref: "selection_1".into(),
        job_ref: "job_1".into(),
        report_ref: "report_0".into(),
        vault_file: format!("{}.qtn", "a".repeat(32)),
        state: QuarantineResultState::OriginalRetained,
    };
    receipt.validate().unwrap();
    assert_eq!(
        serde_json::to_value(&receipt).unwrap()["state"],
        "original_retained"
    );
    for name in ["../secret.qtn", "C:\\secret.qtn", "a.qtn"] {
        receipt.vault_file = name.into();
        assert!(receipt.validate().is_err());
    }
    assert!(serde_json::from_str::<QuarantineResultState>(r#""protected""#).is_err());
    assert!(serde_json::from_str::<QuarantineErrorCode>(r#""raw_error""#).is_err());
}
