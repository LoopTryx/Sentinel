use crate::engine::Engine;
use crate::vault::Vault;
use std::path::PathBuf;
use std::time::{Duration, Instant};

fn completed_job(jobs: &mut crate::scan_jobs::SelectedJobs, source: &std::path::Path) -> String {
    let selection = jobs
        .select(
            "trusted-main",
            source.to_path_buf(),
            crate::scan_jobs::SelectionKind::File,
            Instant::now(),
        )
        .unwrap();
    let job = jobs
        .start("trusted-main", &selection, Instant::now())
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if jobs.poll("trusted-main", &job).unwrap().finished {
            return job;
        }
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(10));
    }
}

#[test]
fn job_bound_quarantine_requires_native_confirmation_and_consumes_once() {
    use sentinel_proto::quarantine_action::{
        QuarantineActionReference, QuarantineErrorCode, QuarantinePrepareRequest,
        QuarantineResultState,
    };
    let root = root();
    let source = root.join("ordinary.txt");
    let bytes = b"harmless job action bytes";
    std::fs::write(&source, bytes).unwrap();
    let mut jobs = crate::scan_jobs::SelectedJobs::default();
    let job = completed_job(&mut jobs, &source);
    let request = QuarantinePrepareRequest {
        job_ref: job,
        report_ref: "report_0".into(),
    };
    let preview = jobs
        .prepare_quarantine("trusted-main", &request, Instant::now())
        .unwrap();
    preview.validate().unwrap();
    let wire = serde_json::to_string(&preview).unwrap();
    assert!(!wire.contains("ordinary.txt"));
    assert!(!wire.contains(root.to_str().unwrap()));
    assert_eq!(
        jobs.prepare_quarantine("foreign", &request, Instant::now())
            .unwrap_err()
            .code,
        QuarantineErrorCode::JobUnavailable
    );
    assert_eq!(
        jobs.prepare_quarantine(
            "trusted-main",
            &QuarantinePrepareRequest {
                job_ref: request.job_ref.clone(),
                report_ref: "report_64".into()
            },
            Instant::now()
        )
        .unwrap_err()
        .code,
        QuarantineErrorCode::ReportUnavailable
    );
    let action = QuarantineActionReference {
        action_ref: preview.action_ref,
    };
    let vault = Vault::new(&root.join("app"));
    let superseding = jobs
        .prepare_quarantine("trusted-main", &request, Instant::now())
        .unwrap();
    assert_eq!(
        jobs.quarantine_after_native_confirmation(
            "trusted-main",
            &action,
            Instant::now(),
            &vault,
            true
        )
        .unwrap_err()
        .code,
        QuarantineErrorCode::ActionUnavailable
    );
    let action = QuarantineActionReference {
        action_ref: superseding.action_ref,
    };
    assert_eq!(
        jobs.quarantine_after_native_confirmation(
            "foreign",
            &action,
            Instant::now(),
            &vault,
            false
        )
        .unwrap_err()
        .code,
        QuarantineErrorCode::ActionUnavailable
    );
    assert_eq!(
        jobs.quarantine_after_native_confirmation(
            "trusted-main",
            &action,
            Instant::now(),
            &vault,
            false
        )
        .unwrap_err()
        .code,
        QuarantineErrorCode::Declined
    );
    assert_eq!(
        jobs.quarantine_after_native_confirmation(
            "trusted-main",
            &action,
            Instant::now(),
            &vault,
            true
        )
        .unwrap_err()
        .code,
        QuarantineErrorCode::ActionUnavailable
    );
    assert_eq!(std::fs::read(&source).unwrap(), bytes);
    assert!(!root.join("app/vault.key").exists());
    let preview = jobs
        .prepare_quarantine("trusted-main", &request, Instant::now())
        .unwrap();
    let action = QuarantineActionReference {
        action_ref: preview.action_ref,
    };
    let receipt = jobs
        .quarantine_after_native_confirmation("trusted-main", &action, Instant::now(), &vault, true)
        .unwrap();
    receipt.validate().unwrap();
    assert_eq!(receipt.state, QuarantineResultState::Quarantined);
    assert_eq!(receipt.job_ref, request.job_ref);
    assert_eq!(receipt.report_ref, request.report_ref);
    assert!(!source.exists());
    let old_report_refused = jobs
        .prepare_quarantine("trusted-main", &request, Instant::now())
        .is_err();
    assert_eq!(
        jobs.quarantine_after_native_confirmation(
            "trusted-main",
            &action,
            Instant::now(),
            &vault,
            true
        )
        .unwrap_err()
        .code,
        QuarantineErrorCode::ActionUnavailable
    );
    vault
        .restore(&receipt.vault_file, &root.join("restored.txt"))
        .unwrap();
    assert_eq!(std::fs::read(root.join("restored.txt")).unwrap(), bytes);
    drop(jobs);
    std::fs::remove_dir_all(root).unwrap();
    assert!(
        old_report_refused,
        "approved action must retire report eligibility until a fresh scan"
    );
}

#[test]
fn action_expiry_and_new_selection_preserve_all_source_bytes() {
    use sentinel_proto::quarantine_action::{
        QuarantineActionReference, QuarantineErrorCode, QuarantinePrepareRequest,
    };
    let root = root();
    let source = root.join("ordinary.txt");
    let next = root.join("next.txt");
    let bytes = b"harmless expired action bytes";
    std::fs::write(&source, bytes).unwrap();
    std::fs::write(&next, b"harmless next selection").unwrap();
    let mut jobs = crate::scan_jobs::SelectedJobs::default();
    let job = completed_job(&mut jobs, &source);
    let request = QuarantinePrepareRequest {
        job_ref: job,
        report_ref: "report_0".into(),
    };
    let now = Instant::now();
    let preview = jobs
        .prepare_quarantine("trusted-main", &request, now)
        .unwrap();
    let action = QuarantineActionReference {
        action_ref: preview.action_ref,
    };
    let vault = Vault::new(&root.join("app"));
    assert_eq!(
        jobs.quarantine_after_native_confirmation(
            "trusted-main",
            &action,
            now + Duration::from_secs(30),
            &vault,
            true
        )
        .unwrap_err()
        .code,
        QuarantineErrorCode::ActionUnavailable
    );
    let preview = jobs
        .prepare_quarantine("trusted-main", &request, Instant::now())
        .unwrap();
    let action = QuarantineActionReference {
        action_ref: preview.action_ref,
    };
    jobs.select(
        "trusted-main",
        next.clone(),
        crate::scan_jobs::SelectionKind::File,
        Instant::now(),
    )
    .unwrap();
    assert_eq!(
        jobs.quarantine_after_native_confirmation(
            "trusted-main",
            &action,
            Instant::now(),
            &vault,
            true
        )
        .unwrap_err()
        .code,
        QuarantineErrorCode::ActionUnavailable
    );
    assert_eq!(std::fs::read(&source).unwrap(), bytes);
    assert!(!root.join("app/vault.key").exists());
    completed_job(&mut jobs, &next);
    assert_eq!(
        jobs.prepare_quarantine("trusted-main", &request, Instant::now())
            .unwrap_err()
            .code,
        QuarantineErrorCode::JobUnavailable
    );
    drop(jobs);
    assert_eq!(std::fs::read(&next).unwrap(), b"harmless next selection");
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn changed_subject_failure_consumes_job_action_without_blob() {
    use sentinel_proto::quarantine_action::{
        QuarantineActionReference, QuarantineErrorCode, QuarantinePrepareRequest,
    };
    let root = root();
    let source = root.join("ordinary.txt");
    std::fs::write(&source, b"harmless original job bytes").unwrap();
    let mut jobs = crate::scan_jobs::SelectedJobs::default();
    let job = completed_job(&mut jobs, &source);
    let request = QuarantinePrepareRequest {
        job_ref: job,
        report_ref: "report_0".into(),
    };
    let preview = jobs
        .prepare_quarantine("trusted-main", &request, Instant::now())
        .unwrap();
    let action = QuarantineActionReference {
        action_ref: preview.action_ref,
    };
    let modified = b"harmless modified job bytes";
    std::fs::write(&source, modified).unwrap();
    let vault = Vault::new(&root.join("app"));
    assert_eq!(
        jobs.quarantine_after_native_confirmation(
            "trusted-main",
            &action,
            Instant::now(),
            &vault,
            true
        )
        .unwrap_err()
        .code,
        QuarantineErrorCode::ActionFailed
    );
    let old_report_refused = jobs
        .prepare_quarantine("trusted-main", &request, Instant::now())
        .is_err();
    assert_eq!(
        jobs.quarantine_after_native_confirmation(
            "trusted-main",
            &action,
            Instant::now(),
            &vault,
            true
        )
        .unwrap_err()
        .code,
        QuarantineErrorCode::ActionUnavailable
    );
    assert_eq!(std::fs::read(&source).unwrap(), modified);
    assert!(!root.join("app/vault.key").exists());
    assert!(std::fs::read_dir(&vault.dir).unwrap().next().is_none());
    drop(jobs);
    std::fs::remove_dir_all(root).unwrap();
    assert!(
        old_report_refused,
        "failed approved action must require fresh inspection, not another old-report preview"
    );
}

#[test]
fn late_cancel_invalidates_action_without_relabeling_completed_evidence() {
    use sentinel_proto::quarantine_action::{
        QuarantineActionReference, QuarantineErrorCode, QuarantinePrepareRequest,
    };
    let root = root();
    let source = root.join("ordinary.txt");
    let bytes = b"harmless cancelled action bytes";
    std::fs::write(&source, bytes).unwrap();
    let mut jobs = crate::scan_jobs::SelectedJobs::default();
    let job = completed_job(&mut jobs, &source);
    let request = QuarantinePrepareRequest {
        job_ref: job.clone(),
        report_ref: "report_0".into(),
    };
    let preview = jobs
        .prepare_quarantine("trusted-main", &request, Instant::now())
        .unwrap();
    let action = QuarantineActionReference {
        action_ref: preview.action_ref,
    };
    jobs.cancel("trusted-main", &job).unwrap();
    let vault = Vault::new(&root.join("app"));
    assert_eq!(
        jobs.quarantine_after_native_confirmation(
            "trusted-main",
            &action,
            Instant::now(),
            &vault,
            true
        )
        .unwrap_err()
        .code,
        QuarantineErrorCode::ActionUnavailable
    );
    assert_eq!(
        jobs.prepare_quarantine("trusted-main", &request, Instant::now())
            .unwrap_err()
            .code,
        QuarantineErrorCode::ReportUnavailable
    );
    let snapshot = jobs.poll_wire("trusted-main", &job).unwrap();
    assert_eq!(
        snapshot.reports[0].state,
        sentinel_proto::file_inspection::FileInspectionState::Completed
    );
    assert_eq!(std::fs::read(&source).unwrap(), bytes);
    assert!(!root.join("app/vault.key").exists());
    drop(jobs);
    std::fs::remove_dir_all(root).unwrap();
}

fn root() -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "sentinel-inspected-action-{}",
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir(&root).unwrap();
    root
}

#[test]
fn same_content_replacement_is_refused_before_key_or_blob() {
    let root = root();
    let source = root.join("ordinary.txt");
    let saved = root.join("saved.txt");
    let bytes = b"harmless same-content identity test";
    std::fs::write(&source, bytes).unwrap();
    let report = Engine::default().scan_file(&source, &|_| None);
    let subject = report.inspected_subject().unwrap();
    std::fs::rename(&source, &saved).unwrap();
    std::fs::write(&source, bytes).unwrap();
    let vault = Vault::new(&root.join("app"));
    let refused = vault.quarantine_inspected(&source, subject).is_err();
    let no_key = !root.join("app/vault.key").exists();
    let no_blob = std::fs::read_dir(&vault.dir).unwrap().next().is_none();
    assert_eq!(std::fs::read(&source).unwrap(), bytes);
    assert_eq!(std::fs::read(&saved).unwrap(), bytes);
    std::fs::remove_dir_all(root).unwrap();
    assert!(
        refused && no_key && no_blob,
        "same digest must not authorize a different object"
    );
}

#[test]
fn changed_content_on_original_object_is_refused_before_key_or_blob() {
    let root = root();
    let source = root.join("ordinary.txt");
    let original = b"harmless original bytes";
    std::fs::write(&source, original).unwrap();
    let report = Engine::default().scan_file(&source, &|_| None);
    let subject = report.inspected_subject().unwrap();
    let replacement = b"harmless modified bytes";
    assert_eq!(original.len(), replacement.len());
    std::fs::write(&source, replacement).unwrap();
    let vault = Vault::new(&root.join("app"));
    let refused = vault.quarantine_inspected(&source, subject).is_err();
    let no_key = !root.join("app/vault.key").exists();
    let no_blob = std::fs::read_dir(&vault.dir).unwrap().next().is_none();
    assert_eq!(std::fs::read(&source).unwrap(), replacement);
    std::fs::remove_dir_all(root).unwrap();
    assert!(
        refused && no_key && no_blob,
        "object identity must not authorize changed contents"
    );
}

#[test]
fn inspected_subject_is_private_and_checked_round_trip_keeps_exact_bytes() {
    let root = root();
    let source = root.join("ordinary.txt");
    let target = root.join("restored.txt");
    let bytes = b"harmless inspected round trip";
    std::fs::write(&source, bytes).unwrap();
    let report = Engine::default().scan_file(&source, &|_| None);
    let subject = report.inspected_subject().unwrap();
    assert_eq!(format!("{subject:?}"), "InspectedSubject { private }");
    let value = serde_json::to_value(&report).unwrap();
    assert!(value.get("subject").is_none());
    let vault = Vault::new(&root.join("app"));
    let outcome = vault.quarantine_inspected(&source, subject).unwrap();
    assert!(outcome.original_removed);
    assert!(!source.exists());
    vault.restore(&outcome.vault_file, &target).unwrap();
    assert!(
        vault.quarantine_inspected(&target, subject).is_err(),
        "restored bytes are a new object, not the original inspected subject"
    );
    assert_eq!(std::fs::read(&target).unwrap(), bytes);
    std::fs::remove_dir_all(root).unwrap();
}
