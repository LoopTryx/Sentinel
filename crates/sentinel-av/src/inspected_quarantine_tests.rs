use crate::engine::Engine;
use crate::vault::Vault;
use std::path::PathBuf;

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
