use sentinel_av::vault::Vault;

#[test]
fn aggregate_bytes_and_entries_refuse_quarantine_without_removing_source() {
    for entries in [false, true] {
        let root = std::env::temp_dir().join(format!("sentinel-capacity-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let vault = Vault::new(&root.join("app"));
        std::fs::write(root.join("app/vault.key"), [7u8; 32]).unwrap();
        if entries {
            for index in 0..128 {
                std::fs::write(vault.dir.join(format!("existing-{index}")), b"").unwrap();
            }
        } else {
            std::fs::File::create(vault.dir.join("existing-large"))
                .unwrap()
                .set_len(64 * 1024 * 1024)
                .unwrap();
        }
        let source = root.join("harmless.txt");
        std::fs::write(&source, b"preserve on quota refusal").unwrap();
        assert!(vault.quarantine(&source).is_err());
        assert_eq!(
            std::fs::read(&source).unwrap(),
            b"preserve on quota refusal"
        );
        assert_eq!(
            std::fs::read(root.join("app/vault.key")).unwrap(),
            [7u8; 32]
        );
        std::fs::remove_dir_all(root).unwrap();
    }
}

#[cfg(windows)]
#[test]
fn retained_admission_blocks_other_mutations_and_preserves_source() {
    use std::os::windows::fs::OpenOptionsExt;
    let root = std::env::temp_dir().join(format!("sentinel-admission-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let vault = Vault::new(&root.join("app"));
    let source = root.join("harmless.txt");
    std::fs::write(&source, b"ordinary harmless admitted bytes").unwrap();
    let reference = vault.quarantine(&source).unwrap().vault_file;
    let lock = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .share_mode(0)
        .open(vault.dir.join(".admission.lock"))
        .unwrap();
    std::fs::write(&source, b"preserve while admission held").unwrap();
    assert!(vault.quarantine(&source).is_err());
    assert!(vault
        .restore(&reference, &root.join("blocked-target.txt"))
        .is_err());
    assert!(vault.destroy(&reference).is_err());
    assert!(vault.resume_destroy(&reference).is_err());
    assert_eq!(
        std::fs::read(&source).unwrap(),
        b"preserve while admission held"
    );
    assert!(vault.dir.join(&reference).exists());
    assert!(!root.join("blocked-target.txt").exists());
    drop(lock);
    vault
        .restore(&reference, &root.join("restored.txt"))
        .unwrap();
    assert_eq!(
        std::fs::read(root.join("restored.txt")).unwrap(),
        b"ordinary harmless admitted bytes"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn unsupported_storage_children_block_admission_before_key_creation() {
    let root =
        std::env::temp_dir().join(format!("sentinel-storage-child-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let vault = Vault::new(&root.join("app"));
    std::fs::create_dir(vault.dir.join("unsupported-directory")).unwrap();
    let source = root.join("harmless.txt");
    std::fs::write(&source, b"retain harmless original").unwrap();
    assert!(vault.quarantine(&source).is_err());
    assert!(!root.join("app/vault.key").exists());
    assert_eq!(std::fs::read(&source).unwrap(), b"retain harmless original");
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn normal_population_near_entry_limit_keeps_restore_and_destroy_headroom() {
    let root = std::env::temp_dir().join(format!(
        "sentinel-capacity-recovery-{}",
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir(&root).unwrap();
    let vault = Vault::new(&root.join("app"));
    let source = root.join("tiny.txt");
    let mut references = Vec::new();
    for _ in 0..70 {
        std::fs::write(&source, b"tiny harmless bytes").unwrap();
        match vault.quarantine(&source) {
            Ok(outcome) => references.push(outcome.vault_file),
            Err(_) => break,
        }
    }
    assert!(!references.is_empty());
    assert_eq!(std::fs::read(&source).unwrap(), b"tiny harmless bytes");
    for (index, reference) in references.iter().enumerate() {
        if index % 2 == 0 {
            let target = root.join(format!("restore-{index}.txt"));
            vault.restore(reference, &target).unwrap();
            assert_eq!(std::fs::read(target).unwrap(), b"tiny harmless bytes");
        } else {
            vault.destroy(reference).unwrap();
        }
    }
    std::fs::remove_dir_all(root).unwrap();
}
