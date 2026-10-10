#![cfg(windows)]
use sentinel_av::vault::Vault;
use std::path::Path;

fn junction(link: &Path, target: &Path) {
    let result = std::process::Command::new("cmd.exe")
        .args(["/c", "mklink", "/J"])
        .arg(link)
        .arg(target)
        .output()
        .unwrap();
    assert!(result.status.success(), "owned junction setup failed");
}

#[test]
fn intermediate_and_leaf_junctions_refuse_without_source_or_storage_changes() {
    for leaf in [false, true] {
        let root = std::env::temp_dir().join(format!("sentinel-ancestry-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let other = root.join("other");
        std::fs::create_dir(&other).unwrap();
        let app = root.join("app");
        std::fs::create_dir(&app).unwrap();
        let link = if leaf {
            app.join("vault")
        } else {
            root.join("redirect")
        };
        junction(&link, &other);
        let data = if leaf { app.clone() } else { link.join("app") };
        let vault = Vault::new(&data);
        let source = root.join("harmless.txt");
        std::fs::write(&source, b"preserve harmless source").unwrap();
        let refused = vault.quarantine(&source).is_err();
        let source_preserved =
            std::fs::read(&source).ok().as_deref() == Some(b"preserve harmless source");
        let untouched = std::fs::read_dir(&other).unwrap().next().is_none();
        let no_key = !app.join("vault.key").exists();
        std::fs::remove_dir(&link).unwrap();
        std::fs::remove_dir_all(&root).unwrap();
        assert!(
            refused && source_preserved && untouched && no_key,
            "redirected storage must refuse before initialization or mutation"
        );
    }
}

#[test]
fn parent_traversal_and_reassigned_public_directory_refuse() {
    let root = std::env::temp_dir().join(format!("sentinel-storage-path-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    std::fs::create_dir(root.join("safe")).unwrap();
    let source = root.join("harmless.txt");
    std::fs::write(&source, b"ordinary source").unwrap();
    let unsupported = Vault::new(&root.join("safe/../app"));
    let traversal_refused = unsupported.quarantine(&source).is_err();
    let no_initialization = !root.join("app").exists();
    std::fs::write(&source, b"ordinary source").unwrap();
    let mut vault = Vault::new(&root.join("supported"));
    std::fs::create_dir(root.join("other")).unwrap();
    vault.dir = root.join("other");
    let reassigned_refused = vault.quarantine(&source).is_err();
    let source_preserved = std::fs::read(&source).ok().as_deref() == Some(b"ordinary source");
    std::fs::remove_dir_all(&root).unwrap();
    assert!(traversal_refused && no_initialization && reassigned_refused && source_preserved);
}

#[test]
fn replaced_app_ancestor_refuses_existing_recovery_and_mutations() {
    let root =
        std::env::temp_dir().join(format!("sentinel-replaced-path-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let app = root.join("app");
    let vault = Vault::new(&app);
    let source = root.join("harmless.txt");
    std::fs::write(&source, b"harmless recovery bytes").unwrap();
    let reference = vault.quarantine(&source).unwrap().vault_file;
    let other = root.join("relocated");
    std::fs::rename(&app, &other).unwrap();
    junction(&app, &other);
    let blob_before = std::fs::read(other.join("vault").join(&reference)).unwrap();
    let target = root.join("target.txt");
    let refused_summary = vault.recovery_summary(&reference).is_err();
    let refused_restore = vault.restore(&reference, &target).is_err();
    let refused_destroy = vault.destroy(&reference).is_err();
    let refused_resumes = vault.resume_restore(&reference, &target).is_err()
        && vault.resume_destroy(&reference).is_err();
    let unchanged = std::fs::read(other.join("vault").join(&reference))
        .ok()
        .as_deref()
        == Some(blob_before.as_slice())
        && !target.exists();
    std::fs::remove_dir(&app).unwrap();
    std::fs::remove_dir_all(&root).unwrap();
    assert!(refused_summary && refused_restore && refused_destroy && refused_resumes && unchanged);
}

#[test]
fn unsupported_names_and_depth_refuse_before_directory_creation() {
    let root = std::env::temp_dir().join(format!("sentinel-invalid-path-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let mut deep = root.clone();
    for _ in 0..35 {
        deep.push("depth");
    }
    for data in [
        root.join("NUL.txt"),
        root.join("alias."),
        root.join("stream:name"),
        root.join("app/./data"),
        root.join("x".repeat(1025)),
        deep,
    ] {
        let vault = Vault::new(&data);
        assert!(vault.quarantine(&root.join("absent.txt")).is_err());
        assert!(std::fs::read_dir(&root).unwrap().next().is_none());
    }
    std::fs::remove_dir_all(root).unwrap();
}
