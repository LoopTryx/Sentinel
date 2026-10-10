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
