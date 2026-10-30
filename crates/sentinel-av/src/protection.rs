//! Native protection pipeline. Input bytes, signature verdict and deletion
//! identity remain in the same owned worker. No renderer-supplied verdicts.
use crate::{
    engine::Engine,
    official_signatures::{OfficialEngine, MAX_FILE_BYTES},
    vault::Vault,
    InspectedSubject,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs::OpenOptions,
    io::Read,
    os::windows::fs::{MetadataExt, OpenOptionsExt},
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileResult {
    pub path: String,
    pub state: String,
    pub bytes: u64,
    pub sha256: Option<String>,
    pub signals: Vec<String>,
    pub quarantine: Option<String>,
    pub quarantine_state: Option<String>,
}
struct DirectoryFrame {
    _guard: crate::storage_path::DirectoryGuard,
    entries: std::fs::ReadDir,
    path: std::path::PathBuf,
    depth: u32,
}
pub struct Walk {
    roots: Vec<std::path::PathBuf>,
    frames: Vec<DirectoryFrame>,
    excluded: Vec<std::path::PathBuf>,
    pub limited: bool,
}
impl Walk {
    pub fn new(mut roots: Vec<std::path::PathBuf>, excluded: Vec<std::path::PathBuf>) -> Self {
        roots.reverse();
        Self {
            roots,
            frames: Vec::new(),
            excluded,
            limited: false,
        }
    }
}
impl Iterator for Walk {
    type Item = Result<(std::path::PathBuf, std::fs::Metadata), String>;
    fn next(&mut self) -> Option<Self::Item> {
        loop {
            let (path, depth) = if let Some(frame) = self.frames.last_mut() {
                match frame.entries.next() {
                    Some(Ok(entry)) => (frame.path.join(entry.file_name()), frame.depth + 1),
                    Some(Err(_)) => return Some(Err("directory entry unavailable".into())),
                    None => {
                        self.frames.pop();
                        continue;
                    }
                }
            } else {
                (self.roots.pop()?, 0)
            };
            let label = path.to_string_lossy().to_ascii_lowercase();
            if self.excluded.iter().any(|p| {
                let prefix = p.to_string_lossy().to_ascii_lowercase();
                label == prefix || label.starts_with(&(prefix + "\\"))
            }) {
                continue;
            }
            let name = path.file_name().and_then(|v| v.to_str()).unwrap_or("");
            if matches!(name, "System Volume Information" | "$Recycle.Bin") {
                return Some(Err("protected system directory omitted".into()));
            }
            let metadata = match std::fs::symlink_metadata(&path) {
                Ok(v) => v,
                Err(_) => return Some(Err("metadata unavailable".into())),
            };
            if metadata.file_attributes() & 0x400 != 0 {
                return Some(Err("linked entry omitted".into()));
            }
            if metadata.is_dir() {
                if depth >= 64 {
                    self.limited = true;
                    return Some(Err("directory depth limit".into()));
                }
                let guard = match crate::storage_path::retain_scan_ancestry(&path, true) {
                    Ok(v) => v,
                    Err(e) => return Some(Err(e)),
                };
                let entries = match std::fs::read_dir(&guard.path) {
                    Ok(v) => v,
                    Err(_) => return Some(Err("directory unavailable".into())),
                };
                self.frames.push(DirectoryFrame {
                    _guard: guard,
                    entries,
                    path: path.clone(),
                    depth,
                });
            }
            return Some(Ok((path, metadata)));
        }
    }
}
impl FileResult {
    fn incomplete(path: &Path) -> Self {
        Self {
            path: path.to_string_lossy().chars().take(1024).collect(),
            state: "incomplete".into(),
            bytes: 0,
            sha256: None,
            signals: Vec::new(),
            quarantine: None,
            quarantine_state: None,
        }
    }
}
pub fn inspect(
    engine: &Engine,
    official: &OfficialEngine,
    path: &Path,
    auto_download: bool,
    vault: &Vault,
    cancel: &AtomicBool,
) -> FileResult {
    inspect_with_signature(engine, path, auto_download, vault, cancel, |bytes| {
        official.scan(bytes)
    })
}
// Private test seam supplies a verdict only; production always uses the pinned official engine.
fn inspect_with_signature(
    engine: &Engine,
    path: &Path,
    auto_download: bool,
    vault: &Vault,
    cancel: &AtomicBool,
    scan: impl FnOnce(&[u8]) -> crate::official_signatures::SignatureResult,
) -> FileResult {
    let mut result = FileResult::incomplete(path);
    if cancel.load(Ordering::Acquire) {
        result.state = "cancelled".into();
        return result;
    }
    let Ok(parent) = crate::storage_path::retain_file_parent(path, false) else {
        return result;
    };
    let Ok(mut file) = OpenOptions::new()
        .read(true)
        .share_mode(1)
        .custom_flags(0x00200000)
        .open(&parent.path)
    else {
        return result;
    };
    let Ok(before) = file.metadata() else {
        return result;
    };
    if !before.is_file()
        || before.file_attributes() & 0x400 != 0
        || before.len() > MAX_FILE_BYTES as u64
    {
        return result;
    }
    // Hash in bounded chunks and poll cancellation. Only vault-eligible inputs
    // receive a private snapshot capped at the independent quarantine limit.
    // Automatic removal requires one immutable byte snapshot for both verdict and digest.
    // Pre-existing writable mappings are not revoked by Windows sharing restrictions.
    let snapshot_eligible = before.len() <= crate::vault::MAX_PLAINTEXT_BYTES as u64;
    let mut snapshot = Vec::new();
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    let mut read = 0u64;
    loop {
        if cancel.load(Ordering::Acquire) {
            result.state = "cancelled".into();
            return result;
        }
        let count = match file.read(&mut buffer) {
            Ok(v) => v,
            Err(_) => return result,
        };
        if count == 0 {
            break;
        }
        read += count as u64;
        if read > MAX_FILE_BYTES as u64 {
            return result;
        }
        if snapshot_eligible {
            snapshot.extend_from_slice(&buffer[..count]);
        }
        hasher.update(&buffer[..count]);
    }
    let Ok(after) = file.metadata() else {
        return result;
    };
    if read != before.len()
        || before.len() != after.len()
        || before.last_write_time() != after.last_write_time()
    {
        return result;
    }
    let digest = hex::encode(hasher.finalize());
    let mapped = if snapshot_eligible {
        None
    } else {
        match crate::retained_map::RetainedMap::new(&file, read as usize) {
            Ok(value) => Some(value),
            Err(_) => return result,
        }
    };
    let bytes = match &mapped {
        Some(value) => value.bytes(),
        None => snapshot.as_slice(),
    };
    let Some(subject) = InspectedSubject::capture(&file, &digest, bytes.len() as u64) else {
        return result;
    };
    result.bytes = bytes.len() as u64;
    result.sha256 = Some(digest);
    let signature = scan(bytes);
    if cancel.load(Ordering::Acquire) {
        result.state = "cancelled".into();
        return result;
    }
    result.state = signature.state.into();
    if let Some(name) = signature.name {
        result.signals.push(name);
    }
    // Legacy local rules remain advisory. They never authorize automatic removal.
    let mut cloned = match file.try_clone() {
        Ok(v) => v,
        Err(_) => return result,
    };
    use std::io::{Seek, SeekFrom};
    if cloned.seek(SeekFrom::Start(0)).is_ok() {
        let report = engine.scan_retained_file_with_control(
            (path, &cloned),
            &|_| None,
            &mut || cancel.load(Ordering::Acquire),
            &mut |_| {},
            Instant::now() + Duration::from_secs(30),
        );
        if result.state == "no_match" && report.detections.len() >= 2 {
            result.state = "advisory".into();
            result
                .signals
                .extend(report.detections.iter().take(4).map(|d| d.name.clone()));
        }
    }
    drop(cloned);
    drop(mapped);
    drop(file);
    // No ordinary heuristic, test signature, stale feed or incomplete scan enters
    // the vault. Current encrypted-vault byte limit remains enforced independently.
    if auto_download
        && signature.can_auto_quarantine
        && snapshot_eligible
        && read <= crate::vault::MAX_PLAINTEXT_BYTES as u64
        && !cancel.load(Ordering::Acquire)
    {
        match vault.quarantine_inspected(path, &subject) {
            Ok(receipt) => {
                result.quarantine = Some(receipt.vault_file);
                result.quarantine_state = Some(
                    if receipt.original_removed {
                        "quarantined"
                    } else {
                        "original_retained"
                    }
                    .into(),
                );
            }
            Err(_) => result.quarantine_state = Some("recovery_required".into()),
        }
    } else if auto_download && signature.can_auto_quarantine {
        result.quarantine_state = Some("manual_review_required".into());
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn existing_writable_mapping_cannot_change_the_bytes_authorizing_quarantine() {
        use std::{ffi::c_void, os::windows::io::AsRawHandle, ptr};
        #[link(name = "kernel32")]
        unsafe extern "system" {
            fn CreateFileMappingW(
                file: *mut c_void,
                security: *mut c_void,
                protect: u32,
                high: u32,
                low: u32,
                name: *const u16,
            ) -> *mut c_void;
            fn MapViewOfFile(
                mapping: *mut c_void,
                access: u32,
                high: u32,
                low: u32,
                length: usize,
            ) -> *mut c_void;
            fn UnmapViewOfFile(address: *const c_void) -> i32;
            fn CloseHandle(handle: *mut c_void) -> i32;
        }
        struct Writer(*mut c_void, *mut c_void);
        impl Drop for Writer {
            fn drop(&mut self) {
                unsafe {
                    UnmapViewOfFile(self.1);
                    CloseHandle(self.0);
                }
            }
        }
        let base = std::env::temp_dir().join(format!("sentinel-snapshot-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let source = base.join("ordinary.txt");
        std::fs::write(&source, b"Ordinary harmless snapshot fixture.").unwrap();
        let file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&source)
            .unwrap();
        let mapping = unsafe {
            CreateFileMappingW(file.as_raw_handle(), ptr::null_mut(), 4, 0, 0, ptr::null())
        };
        assert!(!mapping.is_null());
        let view = unsafe { MapViewOfFile(mapping, 2, 0, 0, 0) };
        assert!(!view.is_null());
        let writer = Writer(mapping, view);
        drop(file);
        let called = std::cell::Cell::new(false);
        let result = inspect_with_signature(
            &Engine::new(),
            &source,
            true,
            &Vault::new(&base.join("vault")),
            &AtomicBool::new(false),
            |bytes| {
                called.set(true);
                unsafe {
                    ptr::write_volatile(writer.1.cast::<u8>(), b'X');
                }
                let observed = unsafe { ptr::read_volatile(bytes.as_ptr()) };
                unsafe {
                    ptr::write_volatile(writer.1.cast::<u8>(), b'O');
                }
                assert_eq!(
                    observed, b'O',
                    "signature input must be an immutable snapshot, not the live mapping"
                );
                crate::official_signatures::SignatureResult {
                    state: "no_match",
                    name: None,
                    can_auto_quarantine: false,
                }
            },
        );
        // Some Windows builds refuse the retained read while a writable section exists.
        if result.state == "incomplete" {
            assert!(!called.get());
        } else {
            assert!(called.get());
            assert_eq!(result.state, "no_match");
        }
        assert!(result.quarantine.is_none());
        drop(writer);
        std::fs::remove_dir_all(base).unwrap();
    }
    #[test]
    fn large_writable_mapping_cannot_change_reported_hash_verdict_bytes() {
        use std::{ffi::c_void, os::windows::io::AsRawHandle, ptr};
        #[link(name = "kernel32")]
        unsafe extern "system" {
            fn CreateFileMappingW(
                file: *mut c_void,
                security: *mut c_void,
                protect: u32,
                high: u32,
                low: u32,
                name: *const u16,
            ) -> *mut c_void;
            fn MapViewOfFile(
                mapping: *mut c_void,
                access: u32,
                high: u32,
                low: u32,
                length: usize,
            ) -> *mut c_void;
            fn UnmapViewOfFile(address: *const c_void) -> i32;
            fn CloseHandle(handle: *mut c_void) -> i32;
        }
        struct Writer(*mut c_void, *mut c_void);
        impl Drop for Writer {
            fn drop(&mut self) {
                unsafe {
                    UnmapViewOfFile(self.1);
                    CloseHandle(self.0);
                }
            }
        }
        let base = std::env::temp_dir().join(format!("sentinel-snapshot-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let source = base.join("ordinary.txt");
        std::fs::write(&source, b"Ordinary harmless snapshot fixture.").unwrap();
        std::fs::OpenOptions::new()
            .write(true)
            .open(&source)
            .unwrap()
            .set_len(65 * 1024 * 1024)
            .unwrap();
        let baseline_called = std::cell::Cell::new(false);
        let baseline = inspect_with_signature(
            &Engine::new(),
            &source,
            false,
            &Vault::new(&base.join("baseline-vault")),
            &AtomicBool::new(false),
            |bytes| {
                baseline_called.set(true);
                assert_eq!(bytes.len(), 65 * 1024 * 1024);
                crate::official_signatures::SignatureResult {
                    state: "no_match",
                    name: None,
                    can_auto_quarantine: false,
                }
            },
        );
        assert!(
            baseline_called.get(),
            "ordinary unmapped source must reach scanner"
        );
        assert_eq!(baseline.state, "no_match");
        let file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&source)
            .unwrap();
        file.set_len(65 * 1024 * 1024).unwrap();
        let mapping = unsafe {
            CreateFileMappingW(file.as_raw_handle(), ptr::null_mut(), 4, 0, 0, ptr::null())
        };
        assert!(!mapping.is_null());
        let view = unsafe { MapViewOfFile(mapping, 2, 0, 0, 0) };
        assert!(!view.is_null());
        let writer = Writer(mapping, view);
        drop(file);
        let called = std::cell::Cell::new(false);
        let result = inspect_with_signature(
            &Engine::new(),
            &source,
            true,
            &Vault::new(&base.join("vault")),
            &AtomicBool::new(false),
            |bytes| {
                called.set(true);
                unsafe {
                    ptr::write_volatile(writer.1.cast::<u8>(), b'X');
                }
                let observed = unsafe { ptr::read_volatile(bytes.as_ptr()) };
                unsafe {
                    ptr::write_volatile(writer.1.cast::<u8>(), b'O');
                }
                assert_eq!(
                    observed, b'O',
                    "signature input must be an immutable snapshot, not the live mapping"
                );
                crate::official_signatures::SignatureResult {
                    state: "no_match",
                    name: None,
                    can_auto_quarantine: false,
                }
            },
        );
        // Some Windows builds refuse the retained read while a writable section exists.
        if result.state == "incomplete" {
            assert!(!called.get());
            assert!(result.sha256.is_none());
            assert_eq!(result.bytes, 0);
        } else {
            assert!(called.get());
            assert_eq!(result.state, "no_match");
        }
        assert!(result.quarantine.is_none());
        drop(writer);
        std::fs::remove_dir_all(base).unwrap();
    }
    #[test]
    fn large_harmless_file_is_fully_hashed_without_the_old_256_mib_ceiling() {
        let base = std::env::temp_dir().join(format!("sentinel-large-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let source = base.join("ordinary.dat");
        let file = std::fs::File::create(&source).unwrap();
        file.set_len(300 * 1024 * 1024).unwrap();
        drop(file);
        let result = inspect_with_signature(
            &Engine::new(),
            &source,
            false,
            &Vault::new(&base.join("vault")),
            &AtomicBool::new(false),
            |bytes| {
                assert_eq!(bytes.len(), 300 * 1024 * 1024);
                crate::official_signatures::SignatureResult {
                    state: "no_match",
                    name: None,
                    can_auto_quarantine: false,
                }
            },
        );
        assert_ne!(result.state, "incomplete");
        assert_eq!(result.bytes, 300 * 1024 * 1024);
        assert!(result.sha256.is_some());
        std::fs::remove_dir_all(base).unwrap();
    }
    #[test]
    fn nine_mib_automatic_quarantine_restores_exact_harmless_bytes() {
        let base =
            std::env::temp_dir().join(format!("sentinel-larger-vault-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let source = base.join("ordinary.dat");
        let bytes = vec![b'x'; 9 * 1024 * 1024];
        std::fs::write(&source, &bytes).unwrap();
        let vault = Vault::new(&base.join("vault"));
        let result = inspect_with_signature(
            &Engine::new(),
            &source,
            true,
            &vault,
            &AtomicBool::new(false),
            |_| crate::official_signatures::SignatureResult {
                state: "signature_match",
                name: Some("Synthetic qualification verdict".into()),
                can_auto_quarantine: true,
            },
        );
        assert_eq!(result.quarantine_state.as_deref(), Some("quarantined"));
        vault
            .restore_original(result.quarantine.as_deref().unwrap())
            .unwrap();
        assert_eq!(std::fs::read(&source).unwrap(), bytes);
        std::fs::remove_dir_all(base).unwrap();
    }
    #[test]
    fn automatic_pipeline_quarantines_only_authorized_verdict_and_restores_exact_harmless_bytes() {
        // Synthetic verdicts, real retained read -> hash association -> encrypted vault -> recovery.
        let base =
            std::env::temp_dir().join(format!("sentinel-auto-pipeline-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let engine = Engine::new();
        let vault = Vault::new(&base.join("vault"));
        let cancel = AtomicBool::new(false);
        let bytes = b"Ordinary harmless fixture for automatic containment lifecycle.";
        for (index, state, authorize, automatic) in [
            (0, "signature_match", true, true),
            (1, "advisory", false, true),
            (2, "test_match", false, true),
            (3, "signature_match", false, true),
            (4, "signature_match", true, false),
            (5, "incomplete", false, true),
        ] {
            let source = base.join(format!("safe-{index}.txt"));
            std::fs::write(&source, bytes).unwrap();
            let result =
                inspect_with_signature(&engine, &source, automatic, &vault, &cancel, |_| {
                    crate::official_signatures::SignatureResult {
                        state,
                        name: Some("Synthetic qualification verdict".into()),
                        can_auto_quarantine: authorize,
                    }
                });
            if authorize && automatic {
                assert_eq!(result.quarantine_state.as_deref(), Some("quarantined"));
                assert!(!source.exists());
                vault
                    .restore_original(result.quarantine.as_deref().unwrap())
                    .unwrap();
            } else {
                assert!(result.quarantine.is_none());
            }
            assert_eq!(std::fs::read(&source).unwrap(), bytes);
        }
        std::fs::remove_dir_all(base).unwrap();
    }
    #[test]
    fn unchanged_harmless_subject_can_be_recovered_from_real_encrypted_vault() {
        // Simulated classification, actual object/hash association and vault lifecycle.
        let base =
            std::env::temp_dir().join(format!("sentinel-auto-vault-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let source = base.join("harmless.txt");
        let bytes = b"Ordinary harmless automatic quarantine lifecycle fixture.";
        std::fs::write(&source, bytes).unwrap();
        let file = std::fs::File::open(&source).unwrap();
        let subject = InspectedSubject::capture(
            &file,
            &hex::encode(Sha256::digest(bytes)),
            bytes.len() as u64,
        )
        .unwrap();
        drop(file);
        let vault = Vault::new(&base.join("store"));
        let receipt = vault.quarantine_inspected(&source, &subject).unwrap();
        assert!(receipt.original_removed);
        assert!(!source.exists());
        vault.restore_original(&receipt.vault_file).unwrap();
        assert_eq!(std::fs::read(&source).unwrap(), bytes);
        std::fs::remove_dir_all(base).unwrap();
    }
}
