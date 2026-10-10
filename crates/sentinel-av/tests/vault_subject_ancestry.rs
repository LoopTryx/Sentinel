#![cfg(windows)]
use sentinel_av::vault::Vault;
use std::path::Path;
fn junction(link: &Path, target: &Path) {
    let output = std::process::Command::new("cmd.exe")
        .args(["/c", "mklink", "/J"])
        .arg(link)
        .arg(target)
        .output()
        .unwrap();
    assert!(output.status.success(), "owned junction setup failed");
}
#[test]
fn source_junction_refuses_before_key_or_blob_and_preserves_original() {
    let root =
        std::env::temp_dir().join(format!("sentinel-source-parent-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let other = root.join("other");
    std::fs::create_dir(&other).unwrap();
    std::fs::write(other.join("ordinary.txt"), b"harmless original bytes").unwrap();
    let link = root.join("redirect");
    junction(&link, &other);
    let vault = Vault::new(&root.join("app"));
    let refused = vault.quarantine(&link.join("ordinary.txt")).is_err();
    let preserved = std::fs::read(other.join("ordinary.txt")).ok().as_deref()
        == Some(b"harmless original bytes");
    let no_key = !root.join("app/vault.key").exists();
    let no_blob = std::fs::read_dir(&vault.dir).unwrap().all(|entry| {
        entry
            .unwrap()
            .path()
            .extension()
            .is_none_or(|ext| ext != "qtn")
    });
    std::fs::remove_dir(&link).unwrap();
    std::fs::remove_dir_all(root).unwrap();
    assert!(refused && preserved && no_key && no_blob);
}
#[test]
fn restore_junction_refuses_without_destination_or_blob_changes() {
    let root =
        std::env::temp_dir().join(format!("sentinel-target-parent-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let vault = Vault::new(&root.join("app"));
    let source = root.join("source.txt");
    std::fs::write(&source, b"harmless restore bytes").unwrap();
    let reference = vault.quarantine(&source).unwrap().vault_file;
    let before = std::fs::read(vault.dir.join(&reference)).unwrap();
    let other = root.join("other");
    std::fs::create_dir(&other).unwrap();
    let link = root.join("redirect");
    junction(&link, &other);
    let refused = vault.restore(&reference, &link.join("target.txt")).is_err();
    let unchanged =
        std::fs::read(vault.dir.join(&reference)).ok().as_deref() == Some(before.as_slice());
    let no_target = std::fs::read_dir(&other).unwrap().next().is_none();
    std::fs::remove_dir(&link).unwrap();
    std::fs::remove_dir_all(root).unwrap();
    assert!(refused && unchanged && no_target);
}
#[test]
fn nested_restore_parent_creation_keeps_exact_bytes() {
    let root =
        std::env::temp_dir().join(format!("sentinel-nested-restore-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let vault = Vault::new(&root.join("app"));
    let source = root.join("source.txt");
    std::fs::write(&source, b"ordinary nested bytes").unwrap();
    let reference = vault.quarantine(&source).unwrap().vault_file;
    let target = root.join("new/parent/target.txt");
    vault.restore(&reference, &target).unwrap();
    assert_eq!(std::fs::read(&target).unwrap(), b"ordinary nested bytes");
    assert!(!vault.dir.join(reference).exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn raw_trailing_dot_selection_refuses_source_and_restore_without_mutation() {
    for restore in [false, true] {
        let root =
            std::env::temp_dir().join(format!("sentinel-dot-selection-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let vault = Vault::new(&root.join("app"));
        let source = root.join("source.txt");
        std::fs::write(&source, b"ordinary dot subject bytes").unwrap();
        let safe = if restore {
            let reference = vault.quarantine(&source).unwrap().vault_file;
            let blob_before = std::fs::read(vault.dir.join(&reference)).unwrap();
            let target = root.join("target.txt");
            vault.restore(&reference, &target.join(".")).is_err()
                && !target.exists()
                && std::fs::read(vault.dir.join(reference)).ok().as_deref()
                    == Some(blob_before.as_slice())
        } else {
            vault.quarantine(&source.join(".")).is_err()
                && std::fs::read(&source).ok().as_deref() == Some(b"ordinary dot subject bytes")
                && !root.join("app/vault.key").exists()
        };
        std::fs::remove_dir_all(root).unwrap();
        assert!(safe, "raw dot selection must refuse before file mutation");
    }
}

#[test]
fn overlong_resolved_target_refuses_before_creating_missing_parents() {
    use std::os::windows::ffi::OsStrExt;
    let root = std::env::temp_dir().join(format!("sentinel-long-target-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let vault = Vault::new(&root.join("app"));
    let source = root.join("source.txt");
    std::fs::write(&source, b"ordinary bounded target bytes").unwrap();
    let reference = vault.quarantine(&source).unwrap().vault_file;
    let mut parent = root.clone();
    for _ in 0..5 {
        parent.push("d".repeat(150));
    }
    let length = parent.as_os_str().encode_wide().count();
    let name_length = 1000usize.checked_sub(length + 1).unwrap();
    assert!((1..=255).contains(&name_length));
    let target = parent.join("f".repeat(name_length));
    let refused = vault.restore(&reference, &target).is_err();
    let no_parents = !root.join("d".repeat(150)).exists();
    let blob_retained = vault.dir.join(reference).exists();
    std::fs::remove_dir_all(root).unwrap();
    assert!(
        refused && no_parents && blob_retained,
        "resolved limit must precede parent creation"
    );
}
