use sentinel_proto::quarantine_action::{QuarantineReceipt, QuarantineResultState};
use sentinel_proto::restore_action::*;

fn receipt() -> QuarantineReceipt {
    QuarantineReceipt {
        action_ref: "a".into(),
        selection_ref: "s".into(),
        job_ref: "j".into(),
        report_ref: "report_0".into(),
        vault_file: format!("{}.qtn", "a".repeat(32)),
        state: QuarantineResultState::Quarantined,
    }
}

#[test]
fn restore_requests_refuse_paths_identity_clock_and_approval() {
    for extra in [
        "\"path\":\"C:/private\"",
        "\"owner\":\"caller\"",
        "\"now\":0",
        "\"approved\":true",
    ] {
        assert!(
            serde_json::from_str::<RestorePrepareRequest>(&format!(
                "{{\"quarantineActionRef\":\"a\",{extra}}}"
            ))
            .is_err()
        );
        assert!(
            serde_json::from_str::<RestoreActionReference>(&format!(
                "{{\"restoreRef\":\"r\",{extra}}}"
            ))
            .is_err()
        );
    }
    for value in ["", "C:/private", "a b"] {
        assert!(
            RestorePrepareRequest {
                quarantine_action_ref: value.into()
            }
            .validate()
            .is_err()
        );
        assert!(
            RestoreActionReference {
                restore_ref: value.into()
            }
            .validate()
            .is_err()
        );
    }
}

#[test]
fn restore_output_requires_successful_removal_receipt_and_exact_expiry() {
    let preview = RestorePreview {
        restore_ref: "r".into(),
        quarantine: receipt(),
        expires_after_seconds: 30,
    };
    preview.validate().unwrap();
    let mut altered = preview.clone();
    altered.expires_after_seconds = 31;
    assert!(altered.validate().is_err());
    altered = preview;
    altered.quarantine.state = QuarantineResultState::OriginalRetained;
    assert!(altered.validate().is_err());
    let restored = RestoreReceipt {
        restore_ref: "r".into(),
        quarantine: receipt(),
        state: RestoreResultState::Restored,
    };
    restored.validate().unwrap();
    assert!(serde_json::from_str::<RestoreResultState>("\"quarantined\"").is_err());
    assert_eq!(
        serde_json::to_string(&restored.state).unwrap(),
        "\"restored\""
    );
}
