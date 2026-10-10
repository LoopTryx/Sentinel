use sentinel_av::{quarantine_journal::RecoveryPhase, vault::Vault};

#[test]
fn actual_quarantine_persists_encrypted_metadata_and_torn_tail_needs_recovery() {
    let root = std::env::temp_dir().join(format!("sentinel-journal-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let source = root.join("private-source-name.txt");
    std::fs::write(&source, b"harmless journal fixture").unwrap();
    let vault = Vault::new(&root.join("app"));
    let outcome = vault.quarantine(&source).unwrap();
    let journal = vault.dir.join(outcome.vault_file.replace(".qtn", ".qjr"));
    assert!(journal.exists());
    let bytes = std::fs::read(&journal).unwrap();
    assert!(!bytes
        .windows(b"private-source-name".len())
        .any(|part| part == b"private-source-name"));
    let summary = vault.recovery_summary(&outcome.vault_file).unwrap();
    assert_eq!(summary.phase, RecoveryPhase::RemovalRecorded);
    assert_eq!(summary.plaintext_bytes, "24");
    assert_eq!(summary.sha256.len(), 64);
    assert!(!format!("{summary:?}").contains("private-source-name"));
    for length in 1..=3 {
        let mut trailing = bytes.clone();
        trailing.extend(std::iter::repeat_n(1, length));
        std::fs::write(&journal, trailing).unwrap();
        assert_eq!(
            vault.recovery_summary(&outcome.vault_file).unwrap().phase,
            RecoveryPhase::RecoveryRequired
        );
    }
    let first_end = 8 + u32::from_be_bytes(bytes[4..8].try_into().unwrap()) as usize;
    std::fs::write(&journal, &bytes[..first_end + 5]).unwrap();
    assert_eq!(
        vault.recovery_summary(&outcome.vault_file).unwrap().phase,
        RecoveryPhase::RecoveryRequired
    );
    assert!(vault.dir.join(&outcome.vault_file).exists());
    let second = root.join("second.txt");
    std::fs::write(&second, b"harmless second fixture").unwrap();
    let second_outcome = vault.quarantine(&second).unwrap();
    let second_journal = vault
        .dir
        .join(second_outcome.vault_file.replace(".qtn", ".qjr"));
    std::fs::write(&second_journal, &bytes).unwrap();
    assert!(vault.recovery_summary(&second_outcome.vault_file).is_err());
    assert!(vault.dir.join(&second_outcome.vault_file).exists());
    std::fs::write(&second_journal, vec![0u8; 8193]).unwrap();
    assert!(vault.recovery_summary(&second_outcome.vault_file).is_err());
    assert!(vault.dir.join(&second_outcome.vault_file).exists());
    let mut damaged = bytes.clone();
    damaged[12] ^= 1;
    std::fs::write(&journal, damaged).unwrap();
    assert!(vault.recovery_summary(&outcome.vault_file).is_err());
    assert!(vault.dir.join(&outcome.vault_file).exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn missing_journal_does_not_authorize_actions_or_break_explicit_legacy_restore() {
    let root =
        std::env::temp_dir().join(format!("sentinel-legacy-journal-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let source = root.join("harmless.txt");
    std::fs::write(&source, b"harmless legacy fixture").unwrap();
    let vault = Vault::new(&root.join("app"));
    let outcome = vault.quarantine(&source).unwrap();
    let journal = vault.dir.join(outcome.vault_file.replace(".qtn", ".qjr"));
    std::fs::remove_file(journal).unwrap();
    assert!(vault.recovery_summary(&outcome.vault_file).is_err());
    assert!(vault.recovery_summary("../private").is_err());
    let restored = root.join("explicit-new-target.txt");
    vault.restore(&outcome.vault_file, &restored).unwrap();
    assert_eq!(
        std::fs::read(&restored).unwrap(),
        b"harmless legacy fixture"
    );
    std::fs::remove_dir_all(root).unwrap();
}
