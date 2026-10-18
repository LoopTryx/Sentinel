#![cfg(windows)]
use sentinel_av::vault::Vault;
use std::{
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
};
fn fixture() -> (PathBuf, PathBuf, Vault, String) {
    let root = std::env::temp_dir().join(format!("sentinel-stored-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let source = root.join("harmless.txt");
    std::fs::write(&source, b"harmless durable recovery bytes").unwrap();
    let vault = Vault::new(&root.join("app"));
    let reference = vault.quarantine(&source).unwrap().vault_file;
    (root, source, vault, reference)
}
fn list(root: &Path) -> serde_json::Value {
    let output = Command::new(env!("CARGO_BIN_EXE_sentinel-inspect"))
        .args(["--vault-list"])
        .arg(root.join("app"))
        .output()
        .unwrap();
    assert!(output.status.success());
    serde_json::from_slice(&output.stdout).unwrap()
}
fn action(root: &Path, reference: &str, mode: &str, approved: bool) -> bool {
    let mut child = Command::new(env!("CARGO_BIN_EXE_sentinel-inspect"))
        .arg(mode)
        .arg(root.join("app"))
        .arg(reference)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let mut reader = BufReader::new(child.stdout.take().unwrap());
    let mut preview = String::new();
    reader.read_line(&mut preview).unwrap();
    let preview: serde_json::Value = serde_json::from_str(&preview).unwrap();
    assert_eq!(preview["type"], "stored_preview");
    assert_eq!(preview["reference"], reference);
    let mut input = child.stdin.take().unwrap();
    input
        .write_all(if approved { b"confirm\n" } else { b"decline\n" })
        .unwrap();
    drop(input);
    child.wait().unwrap().success()
}
#[test]
fn new_process_lists_declines_and_restores_original_bytes_after_session_end() {
    let (root, source, vault, reference) = fixture();
    drop(vault);
    let inventory = list(&root);
    assert_eq!(inventory["items"][0]["reference"], reference);
    assert_eq!(inventory["items"][0]["fileName"], "harmless.txt");
    assert!(!inventory.to_string().contains(root.to_str().unwrap()));
    assert!(action(&root, &reference, "--vault-restore", false));
    assert!(!source.exists());
    assert!(action(&root, &reference, "--vault-restore", true));
    assert_eq!(
        std::fs::read(source).unwrap(),
        b"harmless durable recovery bytes"
    );
    assert!(list(&root)["items"].as_array().unwrap().is_empty());
    std::fs::remove_dir_all(root).unwrap();
}
#[test]
fn restart_restore_preserves_occupied_destination_and_recovery_blob() {
    let (root, source, vault, reference) = fixture();
    std::fs::write(&source, b"occupied harmless bytes").unwrap();
    assert!(!action(&root, &reference, "--vault-restore", true));
    assert_eq!(std::fs::read(&source).unwrap(), b"occupied harmless bytes");
    assert!(vault.dir.join(&reference).exists());
    std::fs::remove_file(&source).unwrap();
    assert!(action(&root, &reference, "--vault-restore", true));
    std::fs::remove_dir_all(root).unwrap();
}
#[test]
fn authenticated_inventory_and_actions_refuse_a_different_valid_blob() {
    let (root, source, vault, reference) = fixture();
    let other = root.join("other.txt");
    std::fs::write(&other, b"different harmless bytes").unwrap();
    let second = vault.quarantine(&other).unwrap().vault_file;
    std::fs::copy(vault.dir.join(&second), vault.dir.join(&reference)).unwrap();
    let inventory = vault.inventory().unwrap();
    let item = inventory
        .items
        .iter()
        .find(|item| item.reference == reference)
        .unwrap();
    assert_eq!(item.state, "recovery_required");
    assert!(!item.can_restore && !item.can_destroy);
    assert!(vault.restore_original(&reference).is_err());
    assert!(vault.destroy_authenticated(&reference).is_err());
    assert!(!source.exists());
    assert!(vault.dir.join(reference).exists());
    std::fs::remove_dir_all(root).unwrap();
}
#[test]
fn fresh_process_destroy_needs_confirmation_and_removes_only_selected_copy() {
    let (root, _, vault, reference) = fixture();
    let other = root.join("other.txt");
    std::fs::write(&other, b"other harmless bytes").unwrap();
    let second = vault.quarantine(&other).unwrap().vault_file;
    assert!(action(&root, &reference, "--vault-destroy", false));
    assert!(vault.dir.join(&reference).exists());
    assert!(action(&root, &reference, "--vault-destroy", true));
    assert!(!vault.dir.join(reference).exists());
    assert!(vault.dir.join(second).exists());
    std::fs::remove_dir_all(root).unwrap();
}
#[test]
fn missing_key_or_tampered_journal_refuses_inventory_without_replacement() {
    for missing in [true, false] {
        let (root, _, vault, reference) = fixture();
        if missing {
            std::fs::remove_file(root.join("app/vault.key")).unwrap();
        } else {
            std::fs::write(
                vault.dir.join(reference.replace(".qtn", ".qjr")),
                b"tampered harmless journal",
            )
            .unwrap();
        }
        assert!(vault.inventory().is_err());
        assert!(vault.dir.join(reference).exists());
        if missing {
            assert!(!root.join("app/vault.key").exists());
        }
        std::fs::remove_dir_all(root).unwrap();
    }
}

#[test]
fn interrupted_quarantine_can_recover_authenticated_bytes_without_terminal_receipt() {
    let (root, source, vault, reference) = fixture();
    let journal = vault.dir.join(reference.replace(".qtn", ".qjr"));
    let bytes = std::fs::read(&journal).unwrap();
    let first_end = 8 + u32::from_be_bytes(bytes[4..8].try_into().unwrap()) as usize;
    std::fs::write(&journal, &bytes[..first_end]).unwrap();
    let inventory = vault.inventory().unwrap();
    assert_eq!(inventory.items[0].state, "recovery_required");
    assert!(inventory.items[0].can_restore);
    assert!(!inventory.items[0].can_destroy);
    assert!(action(&root, &reference, "--vault-restore", true));
    assert_eq!(
        std::fs::read(source).unwrap(),
        b"harmless durable recovery bytes"
    );
    std::fs::remove_dir_all(root).unwrap();
}
