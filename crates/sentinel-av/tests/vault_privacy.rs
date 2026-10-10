#![cfg(windows)]
use sentinel_av::vault::Vault;
use std::path::Path;
fn descriptor_dir(path: &Path, broad: bool) {
    descriptor_dir_with_system(path, broad, true);
}
fn descriptor_dir_with_system(path: &Path, broad: bool, system: bool) {
    // Only a fresh owned temporary directory receives this test descriptor.
    // No existing directory ACL is changed and no privileged identity is used.
    let script = r#"$ErrorActionPreference='Stop'; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $acl=New-Object Security.AccessControl.DirectorySecurity; $acl.SetSecurityDescriptorSddlForm('O:'+$sid+'D:P(A;OICI;FA;;;'+$sid+')'+$(if($env:SENTINEL_TEST_SYSTEM -eq '1'){'(A;OICI;FA;;;SY)'}else{''})+$(if($env:SENTINEL_TEST_BROAD -eq '1'){'(A;OICI;FR;;;WD)'}else{''})); [IO.Directory]::CreateDirectory($env:SENTINEL_TEST_PATH,$acl) | Out-Null"#;
    let output = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .env("SENTINEL_TEST_PATH", path)
        .env("SENTINEL_TEST_SYSTEM", if system { "1" } else { "0" })
        .env("SENTINEL_TEST_BROAD", if broad { "1" } else { "0" })
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "owned descriptor directory setup failed"
    );
}
#[test]
fn actual_private_descriptor_accepts_and_broad_read_grant_refuses() {
    let root =
        std::env::temp_dir().join(format!("sentinel-private-policy-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    for broad in [false, true] {
        let dir = root.join(if broad { "broad" } else { "private" });
        descriptor_dir(&dir, false);
        descriptor_dir(&dir.join("vault"), broad);
        let vault = Vault::new(&dir);
        let before = std::fs::read_dir(&dir).unwrap().count();
        let accepted = vault.validate_private_storage().is_ok();
        assert_eq!(accepted, !broad, "actual private descriptor decision");
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), before);
    }
    std::fs::remove_dir_all(root).unwrap();
}
#[test]
fn inherited_or_unavailable_storage_refuses_without_creating_key() {
    let root = std::env::temp_dir().join(format!(
        "sentinel-inherited-policy-{}",
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir(&root).unwrap();
    let vault = Vault::new(&root);
    assert!(vault.validate_private_storage().is_err());
    assert!(!root.join("vault.key").exists());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn broad_key_parent_refuses_even_with_private_vault_directory() {
    let root = std::env::temp_dir().join(format!(
        "sentinel-key-parent-policy-{}",
        uuid::Uuid::new_v4()
    ));
    descriptor_dir(&root, true);
    descriptor_dir(&root.join("vault"), false);
    let vault = Vault::new(&root);
    let refused = vault.validate_private_storage().is_err();
    let no_key = !root.join("vault.key").exists();
    std::fs::remove_dir_all(root).unwrap();
    assert!(refused && no_key);
}

#[test]
fn explicit_owner_only_directories_accept_without_system_grant() {
    let root = std::env::temp_dir().join(format!(
        "sentinel-owner-only-policy-{}",
        uuid::Uuid::new_v4()
    ));
    descriptor_dir_with_system(&root, false, false);
    descriptor_dir_with_system(&root.join("vault"), false, false);
    let vault = Vault::new(&root);
    let accepted = vault.validate_private_storage().is_ok();
    std::fs::remove_dir_all(root).unwrap();
    assert!(accepted);
}

#[test]
fn fresh_initialization_is_private_and_existing_broad_parent_is_unchanged() {
    let root = std::env::temp_dir().join(format!("sentinel-private-init-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let fresh = Vault::new(&root.join("fresh"));
    let private = fresh.validate_private_storage().is_ok();
    let broad = root.join("broad");
    descriptor_dir(&broad, true);
    let rejected = Vault::new(&broad);
    let no_child = !broad.join("vault").exists();
    let refused = rejected.validate_private_storage().is_err();
    std::fs::remove_dir_all(root).unwrap();
    assert!(private && no_child && refused);
}
fn broaden_owned_file(path: &Path) {
    let script = r#"$ErrorActionPreference='Stop'; $acl=[IO.File]::GetAccessControl($env:SENTINEL_TEST_PATH); $rule=[Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),[Security.AccessControl.FileSystemRights]::Read,[Security.AccessControl.AccessControlType]::Allow); $acl.AddAccessRule($rule); [IO.File]::SetAccessControl($env:SENTINEL_TEST_PATH,$acl)"#;
    let output = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .env("SENTINEL_TEST_PATH", path)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "owned-file descriptor setup failed"
    );
}
#[test]
fn broad_key_refuses_before_source_disposition_or_recovery_mutation() {
    let root = std::env::temp_dir().join(format!("sentinel-key-policy-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    descriptor_dir(&root.join("app"), false);
    descriptor_dir(&root.join("app/vault"), false);
    let vault = Vault::new(&root.join("app"));
    let key = root.join("app/vault.key");
    std::fs::write(&key, [7u8; 32]).unwrap();
    broaden_owned_file(&key);
    let source = root.join("ordinary.txt");
    std::fs::write(&source, b"ordinary key policy bytes").unwrap();
    let refused = vault.quarantine(&source).is_err();
    let preserved = std::fs::read(&source).ok().as_deref() == Some(b"ordinary key policy bytes");
    let no_blob = std::fs::read_dir(&vault.dir)
        .unwrap()
        .all(|e| e.unwrap().path().extension().is_none_or(|ext| ext != "qtn"));
    std::fs::remove_dir_all(root).unwrap();
    assert!(refused && preserved && no_blob);
}

#[test]
fn broad_blob_journal_and_admission_handles_refuse_without_losing_recovery() {
    for subject in ["blob", "journal", "admission"] {
        let root =
            std::env::temp_dir().join(format!("sentinel-child-policy-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let vault = Vault::new(&root.join("app"));
        let first = root.join("first.txt");
        std::fs::write(&first, b"ordinary first recovery bytes").unwrap();
        let reference = vault.quarantine(&first).unwrap().vault_file;
        let blob = vault.dir.join(&reference);
        let before = std::fs::read(&blob).unwrap();
        let path = match subject {
            "blob" => blob.clone(),
            "journal" => vault.dir.join(reference.replace(".qtn", ".qjr")),
            _ => vault.dir.join(".admission.lock"),
        };
        broaden_owned_file(&path);
        let target = root.join("restored.txt");
        let next = root.join("next.txt");
        std::fs::write(&next, b"ordinary next source bytes").unwrap();
        let refused = match subject {
            "blob" => vault.restore(&reference, &target).is_err(),
            "journal" => vault.recovery_summary(&reference).is_err(),
            _ => vault.quarantine(&next).is_err(),
        };
        let unchanged = std::fs::read(&blob).ok().as_deref() == Some(before.as_slice())
            && !target.exists()
            && std::fs::read(&next).unwrap() == b"ordinary next source bytes";
        std::fs::remove_dir_all(root).unwrap();
        assert!(
            refused && unchanged,
            "private child refusal must retain recovery/source"
        );
    }
}
