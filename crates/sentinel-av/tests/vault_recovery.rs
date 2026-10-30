use sentinel_av::vault::Vault;
use std::path::PathBuf;

fn fixture() -> (PathBuf, Vault, String) {
    let root = std::env::temp_dir().join(format!("sentinel-recovery-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&root).unwrap();
    let source = root.join("harmless.txt");
    std::fs::write(&source, b"harmless recovery regression").unwrap();
    let vault = Vault::new(&root.join("app"));
    let id = vault.quarantine(&source).unwrap().vault_file;
    (root, vault, id)
}

#[test]
fn damaged_or_missing_key_is_never_replaced_by_restore() {
    for damaged in [true, false] {
        let (root, vault, id) = fixture();
        let key = root.join("app/vault.key");
        if damaged {
            std::fs::write(&key, b"damaged").unwrap();
        } else {
            std::fs::remove_file(&key).unwrap();
        }
        assert!(vault.restore(&id, &root.join("restored.txt")).is_err());
        if damaged {
            assert_eq!(std::fs::read(&key).unwrap(), b"damaged");
        } else {
            assert!(!key.exists());
        }
        assert!(vault.dir.join(&id).exists());
        std::fs::remove_dir_all(root).unwrap();
    }
}

#[test]
fn occupied_restore_target_and_blob_survive() {
    let (root, vault, id) = fixture();
    let target = root.join("occupied.txt");
    std::fs::write(&target, b"keep existing bytes").unwrap();
    assert!(vault.restore(&id, &target).is_err());
    assert_eq!(std::fs::read(&target).unwrap(), b"keep existing bytes");
    assert!(vault.dir.join(id).exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn arbitrary_blob_paths_cannot_be_deleted() {
    let (root, vault, _) = fixture();
    let unrelated = root.join("app/keep.txt");
    std::fs::write(&unrelated, b"keep").unwrap();
    assert!(vault.destroy("../keep.txt").is_err());
    assert_eq!(std::fs::read(&unrelated).unwrap(), b"keep");
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn missing_key_with_recovery_blobs_blocks_new_quarantine() {
    let (root, vault, id) = fixture();
    let key = root.join("app/vault.key");
    std::fs::remove_file(&key).unwrap();
    let source = root.join("second.txt");
    std::fs::write(&source, b"preserve source").unwrap();
    assert!(vault.quarantine(&source).is_err());
    assert!(!key.exists());
    assert_eq!(std::fs::read(source).unwrap(), b"preserve source");
    assert!(vault.dir.join(id).exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn authenticated_restore_remains_byte_exact_and_tampering_preserves_blob() {
    let (root, vault, id) = fixture();
    let target = root.join("restored.txt");
    vault.restore(&id, &target).unwrap();
    assert_eq!(
        std::fs::read(target).unwrap(),
        b"harmless recovery regression"
    );
    assert!(!vault.dir.join(id).exists());
    let source = root.join("second.txt");
    std::fs::write(&source, b"more harmless bytes").unwrap();
    let id = vault.quarantine(&source).unwrap().vault_file;
    let blob = vault.dir.join(&id);
    let mut bytes = std::fs::read(&blob).unwrap();
    *bytes.last_mut().unwrap() ^= 1;
    std::fs::write(&blob, &bytes).unwrap();
    let target = root.join("tampered.txt");
    assert!(vault.restore(&id, &target).is_err());
    assert!(!target.exists());
    assert_eq!(std::fs::read(blob).unwrap(), bytes);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn oversized_source_is_rejected_before_key_or_blob_creation() {
    let root = std::env::temp_dir().join(format!("sentinel-large-vault-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&root).unwrap();
    let source = root.join("large.txt");
    std::fs::File::create(&source)
        .unwrap()
        .set_len(sentinel_av::vault::MAX_PLAINTEXT_BYTES as u64 + 29)
        .unwrap();
    let vault = Vault::new(&root.join("app"));
    assert!(vault.quarantine(&source).is_err());
    assert_eq!(
        std::fs::metadata(&source).unwrap().len(),
        (sentinel_av::vault::MAX_PLAINTEXT_BYTES as u64 + 29)
    );
    assert!(!root.join("app/vault.key").exists());
    assert_eq!(std::fs::read_dir(&vault.dir).unwrap().count(), 0);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn oversized_recovery_input_preserves_blob_and_destination() {
    let (root, vault, id) = fixture();
    let blob = vault.dir.join(&id);
    std::fs::OpenOptions::new()
        .write(true)
        .open(&blob)
        .unwrap()
        .set_len(sentinel_av::vault::MAX_PLAINTEXT_BYTES as u64 + 29)
        .unwrap();
    let target = root.join("restored.txt");
    assert!(vault.restore(&id, &target).is_err());
    assert!(!target.exists());
    assert_eq!(
        std::fs::metadata(&blob).unwrap().len(),
        (sentinel_av::vault::MAX_PLAINTEXT_BYTES as u64 + 29)
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn exact_plaintext_boundary_restores_and_oversized_key_is_preserved() {
    let root =
        std::env::temp_dir().join(format!("sentinel-boundary-vault-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&root).unwrap();
    let source = root.join("boundary.txt");
    std::fs::File::create(&source)
        .unwrap()
        .set_len(sentinel_av::vault::MAX_PLAINTEXT_BYTES as u64)
        .unwrap();
    let vault = Vault::new(&root.join("app"));
    let id = vault.quarantine(&source).unwrap().vault_file;
    assert_eq!(
        std::fs::metadata(vault.dir.join(&id)).unwrap().len(),
        sentinel_av::vault::MAX_PLAINTEXT_BYTES as u64 + 28
    );
    let target = root.join("restored.txt");
    vault.restore(&id, &target).unwrap();
    assert_eq!(
        std::fs::metadata(&target).unwrap().len(),
        sentinel_av::vault::MAX_PLAINTEXT_BYTES as u64
    );
    let second = root.join("second.txt");
    std::fs::write(&second, b"harmless").unwrap();
    let id = vault.quarantine(&second).unwrap().vault_file;
    let key = root.join("app/vault.key");
    std::fs::write(&key, [0u8; 33]).unwrap();
    assert!(vault.restore(&id, &root.join("blocked.txt")).is_err());
    assert_eq!(std::fs::read(&key).unwrap(), [0u8; 33]);
    assert!(vault.dir.join(&id).exists());
    std::fs::remove_dir_all(root).unwrap();
}
