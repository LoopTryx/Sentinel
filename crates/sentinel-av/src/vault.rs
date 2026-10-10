use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use rand::RngCore;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

const MAX_PLAINTEXT_BYTES: usize = 8 * 1024 * 1024;
const MAX_BLOB_BYTES: usize = MAX_PLAINTEXT_BYTES + 12 + 16;

#[cfg(test)]
#[derive(PartialEq, Eq)]
enum ControlledInterruption {
    JournalCommitted,
    SourceDispositionApplied,
}

#[cfg(test)]
#[derive(PartialEq, Eq)]
enum ControlledLifecycleInterruption {
    IntentCommitted,
    BlobDispositionApplied,
}

pub(crate) fn read_bounded(path: &Path, limit: usize) -> Result<Vec<u8>, String> {
    read_bounded_handle(path, limit, false).map(|(_, bytes)| bytes)
}

fn read_bounded_handle(
    path: &Path,
    limit: usize,
    delete_access: bool,
) -> Result<(std::fs::File, Vec<u8>), String> {
    read_bounded_file(path, limit, delete_access, false)
}

pub(crate) fn read_bounded_mutable(
    path: &Path,
    limit: usize,
) -> Result<(std::fs::File, Vec<u8>), String> {
    read_bounded_file(path, limit, false, true)
}

fn read_bounded_file(
    path: &Path,
    limit: usize,
    delete_access: bool,
    write_access: bool,
) -> Result<(std::fs::File, Vec<u8>), String> {
    let metadata =
        std::fs::symlink_metadata(path).map_err(|_| "quarantine input unavailable".to_string())?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > limit as u64 {
        return Err("quarantine input unsupported or exceeds byte limit".into());
    }
    let mut options = std::fs::OpenOptions::new();
    options.read(true);
    options.write(write_access);
    #[cfg(windows)]
    {
        use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
        if metadata.file_attributes() & 0x400 != 0 {
            return Err("quarantine reparse input unsupported".into());
        }
        options.share_mode(1).custom_flags(0x00200000);
        if write_access {
            options.share_mode(0);
        }
        if delete_access {
            // Exclusive retention also excludes other readers that could keep
            // a successful delete disposition pending after this call closes.
            options.share_mode(0).access_mode(0x80000000 | 0x00010000);
        }
    }
    #[cfg(not(windows))]
    let _ = delete_access;
    let file = options
        .open(path)
        .map_err(|_| "quarantine input open failed".to_string())?;
    let opened = file
        .metadata()
        .map_err(|_| "quarantine input metadata failed".to_string())?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if opened.file_attributes() & 0x400 != 0 {
            return Err("quarantine reparse input unsupported".into());
        }
    }
    if !opened.is_file() || opened.len() > limit as u64 {
        return Err("quarantine input unsupported or exceeds byte limit".into());
    }
    let mut bytes = Vec::new();
    (&file)
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "quarantine input read failed".to_string())?;
    let after = file
        .metadata()
        .map_err(|_| "quarantine input metadata failed".to_string())?;
    if bytes.len() > limit
        || after.len() != opened.len()
        || opened.modified().ok() != after.modified().ok()
        || bytes.len() as u64 != opened.len()
    {
        return Err("quarantine input changed or exceeds byte limit".into());
    }
    Ok((file, bytes))
}

#[cfg(windows)]
fn mark_retained_file_for_deletion(file: &std::fs::File) -> bool {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        FileDispositionInfo, SetFileInformationByHandle, FILE_DISPOSITION_INFO,
    };
    let disposition = FILE_DISPOSITION_INFO { DeleteFile: true };
    // SAFETY: File owns a live regular-file handle opened with DELETE access.
    // The synchronous call receives the correctly sized, initialized Win32
    // structure; its borrow and the handle remain live until the call returns.
    // No pathname is reopened or passed to this removal operation.
    unsafe {
        SetFileInformationByHandle(
            file.as_raw_handle(),
            FileDispositionInfo,
            (&disposition as *const FILE_DISPOSITION_INFO).cast(),
            std::mem::size_of::<FILE_DISPOSITION_INFO>() as u32,
        ) != 0
    }
}

/// Local encrypted quarantine candidate. Encryption does not establish file
/// identity, private-directory permissions or crash-safe remediation authority.
pub struct Vault {
    pub dir: PathBuf,
    key_path: PathBuf,
    configured_dir: PathBuf,
    initialized: bool,
}

struct ScopedStorage {
    vault: Vault,
    _guard: crate::storage_path::DirectoryGuard,
}

pub struct QuarantineOutcome {
    pub vault_file: String,
    pub original_removed: bool,
}

impl Vault {
    fn storage_guard(&self) -> Result<ScopedStorage, String> {
        if !self.initialized {
            return Err("quarantine storage initialization unavailable".into());
        }
        if self.dir != self.configured_dir {
            return Err("quarantine storage directory association changed".into());
        }
        let parent = self
            .key_path
            .parent()
            .ok_or("quarantine key parent unsupported")?;
        let guard = crate::storage_path::retain_pinned_directory(&parent.join("vault"))?;
        let dir = guard.path.clone();
        Ok(ScopedStorage {
            vault: Vault {
                dir: dir.clone(),
                key_path: self.key_path.clone(),
                configured_dir: dir,
                initialized: true,
            },
            _guard: guard,
        })
    }
    fn admit_storage(
        &self,
        additional_bytes: u64,
        additional_entries: usize,
        lifecycle_reference: Option<&str>,
    ) -> Result<std::fs::File, String> {
        #[cfg(not(windows))]
        {
            let _ = (additional_bytes, additional_entries, lifecycle_reference);
            Err("quarantine storage admission unsupported".into())
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
            let handle = std::fs::OpenOptions::new()
                .read(true)
                .write(true)
                .create(true)
                .truncate(false)
                .share_mode(0)
                .custom_flags(0x00200000)
                .open(self.dir.join(".admission.lock"))
                .map_err(|_| "quarantine storage admission busy or unavailable")?;
            let lock_metadata = handle
                .metadata()
                .map_err(|_| "quarantine admission metadata failed")?;
            if !lock_metadata.is_file()
                || lock_metadata.len() != 0
                || lock_metadata.file_attributes() & 0x400 != 0
            {
                return Err("quarantine admission file unsupported".into());
            }
            let mut files = std::collections::HashMap::new();
            let mut entries = 0usize;
            let mut bytes = 0u64;
            for entry in
                std::fs::read_dir(&self.dir).map_err(|_| "quarantine storage unavailable")?
            {
                let entry = entry.map_err(|_| "quarantine storage traversal failed")?;
                if entry.file_name() == ".admission.lock" {
                    continue;
                }
                entries += 1;
                if entries > 128 {
                    return Err("quarantine storage entry limit reached".into());
                }
                let metadata = std::fs::symlink_metadata(entry.path())
                    .map_err(|_| "quarantine storage metadata failed")?;
                if !metadata.is_file()
                    || metadata.file_type().is_symlink()
                    || metadata.file_attributes() & 0x400 != 0
                {
                    return Err("quarantine storage child unsupported".into());
                }
                bytes = bytes
                    .checked_add(metadata.len())
                    .ok_or("quarantine storage byte limit reached")?;
                if bytes > 64 * 1024 * 1024 {
                    return Err("quarantine storage byte limit reached".into());
                }
                files.insert(entry.file_name(), metadata.len());
            }
            let canonical = |name: &str, suffix: &str| {
                name.strip_suffix(suffix).is_some_and(|id| {
                    id.len() == 32
                        && id
                            .bytes()
                            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
                })
            };
            let selected_journal =
                lifecycle_reference.map(|reference| reference.replace(".qtn", ".qlj"));
            // Account for future lifecycle capacity, not just current bytes.
            // The selected operation converts its reservation into actual writes.
            for (name, size) in &files {
                let Some(name) = name.to_str() else {
                    continue;
                };
                if canonical(name, ".qtn") && Some(name) != lifecycle_reference {
                    let future = name.replace(".qtn", ".qlj");
                    if !files.contains_key(std::ffi::OsStr::new(&future)) {
                        entries = entries
                            .checked_add(1)
                            .ok_or("quarantine storage entry limit reached")?;
                        bytes = bytes
                            .checked_add(8192)
                            .ok_or("quarantine storage byte limit reached")?;
                    }
                }
                if canonical(name, ".qlj") && selected_journal.as_deref() != Some(name) {
                    bytes = bytes
                        .checked_add(8192u64.saturating_sub(*size))
                        .ok_or("quarantine storage byte limit reached")?;
                }
            }
            if entries
                .checked_add(additional_entries)
                .is_none_or(|count| count > 128)
            {
                return Err("quarantine storage entry limit reached".into());
            }
            if bytes
                .checked_add(additional_bytes)
                .is_none_or(|count| count > 64 * 1024 * 1024)
            {
                return Err("quarantine storage byte limit reached".into());
            }
            Ok(handle)
        }
    }
    /// Explicit reconciliation of a previously flushed restore intent. This
    /// does not grant selection/action authority or overwrite any destination.
    pub fn resume_restore(&self, reference: &str, target: &Path) -> Result<(), String> {
        let storage = self.storage_guard()?;
        let vault = &storage.vault;
        let blob_path = vault.blob_path(reference)?;
        let _admission = vault.admit_storage(2052, 0, Some(reference))?;
        let key = vault.load_key()?;
        let (target_handle, plaintext) = read_bounded_handle(target, MAX_PLAINTEXT_BYTES, false)?;
        let mut journal = crate::quarantine_journal::Journal::resume_lifecycle(
            &vault.dir, reference, target, &plaintext, &key, false,
        )?;
        match std::fs::symlink_metadata(&blob_path) {
            Ok(_) => {
                let (blob_handle, blob) = read_bounded_handle(&blob_path, MAX_BLOB_BYTES, true)?;
                if vault.decrypt_blob(&blob, &key)? != plaintext {
                    return Err("recovery blob does not match verified destination".into());
                }
                #[cfg(windows)]
                {
                    if !mark_retained_file_for_deletion(&blob_handle) {
                        return Err("restored; recovery blob cleanup failed".into());
                    }
                    drop(blob_handle);
                }
                #[cfg(not(windows))]
                {
                    drop(blob_handle);
                    return Err("recovery cleanup unsupported on this platform".into());
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err("recovery blob state unavailable".into()),
        }
        journal.finish_lifecycle(&key)?;
        drop(target_handle);
        Ok(())
    }

    /// Resume only while the selected encrypted blob remains authenticatable.
    /// Missing bytes cannot establish deletion or secure-erasure evidence.
    pub fn resume_destroy(&self, reference: &str) -> Result<(), String> {
        let storage = self.storage_guard()?;
        let vault = &storage.vault;
        let path = vault.blob_path(reference)?;
        let _admission = vault.admit_storage(2052, 0, Some(reference))?;
        let key = vault.load_key()?;
        let (handle, blob) = read_bounded_handle(&path, MAX_BLOB_BYTES, true)?;
        let plaintext = vault.decrypt_blob(&blob, &key)?;
        let mut journal = crate::quarantine_journal::Journal::resume_lifecycle(
            &vault.dir, reference, &self.dir, &plaintext, &key, true,
        )?;
        #[cfg(windows)]
        {
            if !mark_retained_file_for_deletion(&handle) {
                return Err("quarantine blob cleanup failed".into());
            }
            drop(handle);
            journal.finish_lifecycle(&key)
        }
        #[cfg(not(windows))]
        {
            drop(handle);
            let _ = journal;
            Err("recovery cleanup unsupported on this platform".into())
        }
    }
    pub fn recovery_summary(
        &self,
        vault_file: &str,
    ) -> Result<crate::quarantine_journal::RecoverySummary, String> {
        let storage = self.storage_guard()?;
        let vault = &storage.vault;
        vault.blob_path(vault_file)?;
        crate::quarantine_journal::read_summary(&vault.dir, vault_file, &vault.load_key()?)
    }

    pub fn new(app_data: &Path) -> Self {
        let dir = app_data.join("vault");
        let storage = crate::storage_path::retain_directory(&dir, true).ok();
        let initialized = storage.is_some();
        let key_path = storage
            .and_then(|guard| guard.path.parent().map(|parent| parent.join("vault.key")))
            .unwrap_or_else(|| app_data.join("vault.key"));
        Vault {
            configured_dir: dir.clone(),
            dir,
            key_path,
            initialized,
        }
    }

    fn load_or_create_key(&self) -> Result<[u8; 32], String> {
        match self.load_key() {
            Ok(key) => return Ok(key),
            Err(_) if !self.key_path.exists() => {}
            Err(error) => return Err(error),
        }
        // Never generate a replacement while existing recovery blobs need the
        // old key. A missing key requires recovery, not silent reinitialization.
        if std::fs::read_dir(&self.dir)
            .map_err(|_| "vault unavailable".to_string())?
            .find(|entry| match entry {
                Ok(entry) => entry.file_name() != ".admission.lock",
                Err(_) => true,
            })
            .is_some()
        {
            return Err("quarantine key missing; recovery required".into());
        }
        let mut key = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut key);
        let mut output = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&self.key_path)
            .map_err(|_| "quarantine key creation failed".to_string())?;
        output
            .write_all(&key)
            .map_err(|_| "quarantine key write failed".to_string())?;
        output
            .sync_all()
            .map_err(|_| "quarantine key flush failed".to_string())?;
        Ok(key)
    }

    fn load_key(&self) -> Result<[u8; 32], String> {
        let existing = read_bounded(&self.key_path, 32)
            .map_err(|_| "quarantine key unavailable; recovery required".to_string())?;
        existing
            .try_into()
            .map_err(|_| "quarantine key damaged; recovery required".into())
    }

    fn blob_path(&self, reference: &str) -> Result<PathBuf, String> {
        let Some(id) = reference.strip_suffix(".qtn") else {
            return Err("invalid quarantine reference".into());
        };
        if id.len() != 32
            || !id
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return Err("invalid quarantine reference".into());
        }
        Ok(self.dir.join(reference))
    }

    /// Encrypt the file and move it into the vault. The original is deleted
    /// only after the encrypted copy is fully written and verified readable.
    pub fn quarantine(&self, source: &Path) -> Result<QuarantineOutcome, String> {
        #[cfg(test)]
        {
            self.quarantine_inner(source, None)
        }
        #[cfg(not(test))]
        {
            self.quarantine_inner(source)
        }
    }

    fn quarantine_inner(
        &self,
        source: &Path,
        #[cfg(test)] interruption: Option<ControlledInterruption>,
    ) -> Result<QuarantineOutcome, String> {
        let storage = self.storage_guard()?;
        let vault = &storage.vault;
        let (source_handle, plaintext) = read_bounded_handle(source, MAX_PLAINTEXT_BYTES, true)?;
        let _admission = vault.admit_storage(plaintext.len() as u64 + 28 + 2 * 8192, 3, None)?;
        let key_bytes = vault.load_or_create_key()?;

        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let sealed = cipher
            .encrypt(
                nonce,
                Payload {
                    msg: &plaintext,
                    aad: &[],
                },
            )
            .map_err(|_| "encryption failed".to_string())?;

        let id = uuid::Uuid::new_v4().simple().to_string();
        let vault_file = format!("{}.qtn", id);
        let vault_path = vault.dir.join(&vault_file);

        let mut blob = nonce_bytes.to_vec();
        blob.extend_from_slice(&sealed);
        let mut options = std::fs::OpenOptions::new();
        options.read(true).write(true).create_new(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(0).custom_flags(0x00200000);
        }
        let mut output = options
            .open(&vault_path)
            .map_err(|_| "quarantine blob creation failed".to_string())?;
        output
            .write_all(&blob)
            .map_err(|_| "quarantine blob write failed; original retained".to_string())?;
        output
            .sync_all()
            .map_err(|_| "quarantine blob flush failed; original retained".to_string())?;
        // Verify persisted bytes through the same exclusively held blob handle.
        output
            .seek(SeekFrom::Start(0))
            .map_err(|_| "quarantine blob verification failed; original retained".to_string())?;
        let mut stored = Vec::new();
        (&mut output)
            .take(MAX_BLOB_BYTES as u64 + 1)
            .read_to_end(&mut stored)
            .map_err(|_| "quarantine blob verification failed; original retained".to_string())?;
        if stored.len() != blob.len() {
            return Err("quarantine blob verification failed; original retained".into());
        }
        let roundtrip = vault.decrypt_blob(&stored, &key_bytes)?;
        if roundtrip != plaintext {
            return Err("post-encryption verification failed; original left in place".into());
        }

        // Persist authenticated source association before source deletion can
        // occur. The exclusive journal handle stays retained through completion.
        let mut journal = crate::quarantine_journal::Journal::create(
            &vault.dir,
            &vault_file,
            source,
            &plaintext,
            &key_bytes,
        )?;
        #[cfg(test)]
        if interruption == Some(ControlledInterruption::JournalCommitted) {
            return Err("controlled interruption before source disposition".into());
        }

        #[cfg(windows)]
        let original_removed = mark_retained_file_for_deletion(&source_handle);
        drop(source_handle);
        drop(output);
        #[cfg(not(windows))]
        let original_removed = std::fs::remove_file(source).is_ok();
        #[cfg(test)]
        if interruption == Some(ControlledInterruption::SourceDispositionApplied) {
            return Err("controlled interruption before terminal journal receipt".into());
        }
        journal.finish(original_removed, &key_bytes)?;
        Ok(QuarantineOutcome {
            vault_file,
            original_removed,
        })
    }

    pub fn restore(&self, vault_file: &str, to_path: &Path) -> Result<(), String> {
        #[cfg(test)]
        {
            self.restore_inner(vault_file, to_path, None)
        }
        #[cfg(not(test))]
        {
            self.restore_inner(vault_file, to_path)
        }
    }

    fn restore_inner(
        &self,
        vault_file: &str,
        to_path: &Path,
        #[cfg(test)] interruption: Option<ControlledLifecycleInterruption>,
    ) -> Result<(), String> {
        let storage = self.storage_guard()?;
        let vault = &storage.vault;
        let vault_path = vault.blob_path(vault_file)?;
        let key_bytes = vault.load_key()?;
        let (blob_handle, blob) = read_bounded_handle(&vault_path, MAX_BLOB_BYTES, true)?;
        let plaintext = vault.decrypt_blob(&blob, &key_bytes)?;
        let _admission = vault.admit_storage(8192, 1, Some(vault_file))?;
        if let Some(parent) = to_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|_| "restore directory unavailable".to_string())?;
        }
        let mut options = std::fs::OpenOptions::new();
        options.read(true).write(true).create_new(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(0).custom_flags(0x00200000);
        }
        let mut output = options
            .open(to_path)
            .map_err(|_| "restore destination unavailable or occupied".to_string())?;
        // On a partial write, preserve both the encrypted recovery blob and
        // partial destination. Never remove a path that could have been replaced.
        output
            .write_all(&plaintext)
            .map_err(|_| "restore write failed; recovery blob retained".to_string())?;
        output
            .sync_all()
            .map_err(|_| "restore flush failed; recovery blob retained".to_string())?;
        output
            .seek(SeekFrom::Start(0))
            .map_err(|_| "restore verification failed; recovery blob retained".to_string())?;
        let mut persisted = Vec::new();
        (&mut output)
            .take(MAX_PLAINTEXT_BYTES as u64 + 1)
            .read_to_end(&mut persisted)
            .map_err(|_| "restore verification failed; recovery blob retained".to_string())?;
        if persisted != plaintext {
            return Err("restore verification failed; recovery blob retained".into());
        }
        let mut journal = crate::quarantine_journal::Journal::prepare_lifecycle(
            &vault.dir, vault_file, to_path, &plaintext, &key_bytes, false,
        )?;
        #[cfg(test)]
        if interruption == Some(ControlledLifecycleInterruption::IntentCommitted) {
            return Err("controlled interruption after restore intent".into());
        }
        #[cfg(windows)]
        let cleaned = mark_retained_file_for_deletion(&blob_handle);
        drop(blob_handle);
        drop(output);
        #[cfg(windows)]
        if !cleaned {
            return Err("restored; recovery blob cleanup failed".into());
        }
        #[cfg(not(windows))]
        std::fs::remove_file(vault_path)
            .map_err(|_| "restored; recovery blob cleanup failed".to_string())?;
        #[cfg(test)]
        if interruption == Some(ControlledLifecycleInterruption::BlobDispositionApplied) {
            return Err("controlled interruption after restore disposition".into());
        }
        journal.finish_lifecycle(&key_bytes)?;
        Ok(())
    }

    pub fn destroy(&self, vault_file: &str) -> Result<(), String> {
        #[cfg(test)]
        {
            self.destroy_inner(vault_file, None)
        }
        #[cfg(not(test))]
        {
            self.destroy_inner(vault_file)
        }
    }

    fn destroy_inner(
        &self,
        vault_file: &str,
        #[cfg(test)] interruption: Option<ControlledLifecycleInterruption>,
    ) -> Result<(), String> {
        let storage = self.storage_guard()?;
        let vault = &storage.vault;
        let path = vault.blob_path(vault_file)?;
        let key_bytes = vault.load_key()?;
        let (handle, bytes) = read_bounded_handle(&path, MAX_BLOB_BYTES, true)?;
        let plaintext = vault.decrypt_blob(&bytes, &key_bytes)?;
        let _admission = vault.admit_storage(8192, 1, Some(vault_file))?;
        let mut journal = crate::quarantine_journal::Journal::prepare_lifecycle(
            &vault.dir, vault_file, &self.dir, &plaintext, &key_bytes, true,
        )?;
        #[cfg(test)]
        if interruption == Some(ControlledLifecycleInterruption::IntentCommitted) {
            return Err("controlled interruption after destroy intent".into());
        }
        #[cfg(windows)]
        {
            if !mark_retained_file_for_deletion(&handle) {
                return Err("quarantine blob cleanup failed".into());
            }
            drop(handle);
        }
        #[cfg(not(windows))]
        {
            drop(handle);
            std::fs::remove_file(path).map_err(|_| "quarantine blob cleanup failed".to_string())?;
        }
        #[cfg(test)]
        if interruption == Some(ControlledLifecycleInterruption::BlobDispositionApplied) {
            return Err("controlled interruption after destroy disposition".into());
        }
        journal.finish_lifecycle(&key_bytes)
    }

    fn decrypt_blob(&self, blob: &[u8], key_bytes: &[u8; 32]) -> Result<Vec<u8>, String> {
        if blob.len() < 13 {
            return Err("vault blob too short".into());
        }
        let (nonce_bytes, sealed) = blob.split_at(12);
        let key = Key::<Aes256Gcm>::from_slice(key_bytes);
        let cipher = Aes256Gcm::new(key);
        cipher
            .decrypt(
                Nonce::from_slice(nonce_bytes),
                Payload {
                    msg: sealed,
                    aad: &[],
                },
            )
            .map_err(|_| "decryption failed".into())
    }
}

#[cfg(all(test, windows))]
mod retained_source_tests {
    #[test]
    fn rejected_guid_constructor_stays_unavailable_without_mutation() {
        let root = std::env::temp_dir().join(format!(
            "sentinel-invalid-guid-init-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir(&root).unwrap();
        let supported = Vault::new(&root.join("app"));
        let rejected = Vault::new(supported.key_path.parent().unwrap());
        let source = root.join("source.txt");
        std::fs::write(&source, b"preserve rejected constructor bytes").unwrap();
        let refused = rejected.quarantine(&source).is_err();
        let intact =
            std::fs::read(&source).ok().as_deref() == Some(b"preserve rejected constructor bytes");
        let no_key = !supported.key_path.exists();
        std::fs::remove_dir_all(root).unwrap();
        assert!(
            refused && intact && no_key,
            "unsupported constructor must not gain operational availability"
        );
    }

    #[test]
    fn volume_addressed_storage_retains_exact_roundtrip_and_original_receipt_association() {
        let root =
            std::env::temp_dir().join(format!("sentinel-volume-path-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let vault = Vault::new(&root.join("app"));
        let anchored = vault
            .key_path
            .to_string_lossy()
            .starts_with("\\\\?\\Volume{");
        let source = root.join("plain.txt");
        std::fs::write(&source, b"harmless anchored bytes").unwrap();
        let reference = vault.quarantine(&source).unwrap().vault_file;
        let target = root.join("restored.txt");
        vault.restore(&reference, &target).unwrap();
        let exact = std::fs::read(&target).unwrap() == b"harmless anchored bytes";
        // Keep legacy destroy association strings as authenticated metadata;
        // they must not be used as the storage I/O address.
        std::fs::write(&source, b"harmless legacy receipt bytes").unwrap();
        let reference = vault.quarantine(&source).unwrap().vault_file;
        let key = vault.load_key().unwrap();
        let journal = crate::quarantine_journal::Journal::prepare_lifecycle(
            &vault.dir,
            &reference,
            &vault.dir,
            b"harmless legacy receipt bytes",
            &key,
            true,
        )
        .unwrap();
        drop(journal);
        vault.resume_destroy(&reference).unwrap();
        let reconciled = !vault.dir.join(reference).exists();
        std::fs::remove_dir_all(root).unwrap();
        assert!(
            anchored && exact && reconciled,
            "storage must stay volume addressed and preserve receipt compatibility"
        );
    }

    use super::*;

    #[test]
    fn interrupted_restore_and_destroy_preserve_exact_intent_boundary_state() {
        for destroy in [false, true] {
            for interruption in [
                ControlledLifecycleInterruption::IntentCommitted,
                ControlledLifecycleInterruption::BlobDispositionApplied,
            ] {
                let root = std::env::temp_dir().join(format!(
                    "sentinel-lifecycle-interrupted-{}",
                    uuid::Uuid::new_v4()
                ));
                std::fs::create_dir(&root).unwrap();
                let source = root.join("harmless.txt");
                let plaintext = b"harmless lifecycle interruption bytes";
                std::fs::write(&source, plaintext).unwrap();
                let vault = Vault::new(&root.join("app"));
                let reference = vault.quarantine(&source).unwrap().vault_file;
                let target = root.join("explicit-restore-target.txt");
                let before_disposition =
                    interruption == ControlledLifecycleInterruption::IntentCommitted;
                let result = if destroy {
                    vault.destroy_inner(&reference, Some(interruption))
                } else {
                    vault.restore_inner(&reference, &target, Some(interruption))
                };
                assert!(
                    result.is_err(),
                    "injected interruption must stop before completion receipt"
                );
                assert_eq!(vault.dir.join(&reference).exists(), before_disposition);
                let summary = vault.recovery_summary(&reference).unwrap();
                assert_eq!(
                    summary.phase,
                    crate::quarantine_journal::RecoveryPhase::RecoveryRequired
                );
                assert_eq!(summary.plaintext_bytes, plaintext.len().to_string());
                if !destroy {
                    assert_eq!(std::fs::read(&target).unwrap(), plaintext);
                }
                assert_eq!(target.exists(), !destroy);
                // Existing intent must not be overwritten by ordinary retries.
                let journal = vault.dir.join(reference.replace(".qtn", ".qlj"));
                let intent = std::fs::read(&journal).unwrap();
                assert!(vault.destroy(&reference).is_err());
                assert_eq!(std::fs::read(&journal).unwrap(), intent);
                let mut torn = intent.clone();
                torn.push(1);
                std::fs::write(&journal, &torn).unwrap();
                let refused = if destroy {
                    vault.resume_destroy(&reference)
                } else {
                    vault.resume_restore(&reference, &target)
                };
                assert!(refused.is_err());
                assert_eq!(std::fs::read(&journal).unwrap(), torn);
                assert_eq!(vault.dir.join(&reference).exists(), before_disposition);
                // Reset only this owned test fixture, never production recovery.
                std::fs::write(&journal, &intent).unwrap();
                if !destroy {
                    let wrong_target = root.join("wrong-target.txt");
                    std::fs::write(&wrong_target, plaintext).unwrap();
                    assert!(vault.resume_restore(&reference, &wrong_target).is_err());
                    std::fs::write(&target, b"changed harmless destination").unwrap();
                    assert!(vault.resume_restore(&reference, &target).is_err());
                    assert_eq!(
                        std::fs::read(&target).unwrap(),
                        b"changed harmless destination"
                    );
                    assert_eq!(std::fs::read(&journal).unwrap(), intent);
                    assert_eq!(vault.dir.join(&reference).exists(), before_disposition);
                    std::fs::write(&target, plaintext).unwrap();
                    vault.resume_restore(&reference, &target).unwrap();
                    assert_eq!(std::fs::read(&target).unwrap(), plaintext);
                    assert!(!vault.dir.join(&reference).exists());
                    assert_eq!(
                        vault.recovery_summary(&reference).unwrap().phase,
                        crate::quarantine_journal::RecoveryPhase::RestoredRecorded
                    );
                } else if before_disposition {
                    vault.resume_destroy(&reference).unwrap();
                    assert!(!vault.dir.join(&reference).exists());
                    assert_eq!(
                        vault.recovery_summary(&reference).unwrap().phase,
                        crate::quarantine_journal::RecoveryPhase::DestroyedRecorded
                    );
                } else {
                    assert!(vault.resume_destroy(&reference).is_err());
                    assert_eq!(std::fs::read(&journal).unwrap(), intent);
                }
                std::fs::remove_dir_all(root).unwrap();
            }
        }
    }

    #[test]
    fn retained_handle_denies_replacement_and_deletes_only_after_close() {
        let root = std::env::temp_dir().join(format!("sentinel-held-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let source = root.join("harmless.txt");
        std::fs::write(&source, b"harmless retained bytes").unwrap();
        let (handle, bytes) = read_bounded_handle(&source, MAX_PLAINTEXT_BYTES, true).unwrap();
        assert_eq!(bytes, b"harmless retained bytes");
        assert!(std::fs::File::open(&source).is_err());
        assert!(std::fs::write(&source, b"replacement").is_err());
        assert!(std::fs::rename(&source, root.join("renamed.txt")).is_err());
        assert!(mark_retained_file_for_deletion(&handle));
        drop(handle);
        assert!(!source.exists());
        std::fs::write(&source, b"new harmless file after close").unwrap();
        assert_eq!(
            std::fs::read(&source).unwrap(),
            b"new harmless file after close"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn resume_admission_reserves_the_four_byte_frame_prefix() {
        let root =
            std::env::temp_dir().join(format!("sentinel-prefix-budget-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let vault = Vault::new(&root.join("app"));
        let source = root.join("harmless.txt");
        std::fs::write(&source, b"harmless prefix boundary bytes").unwrap();
        let reference = vault.quarantine(&source).unwrap().vault_file;
        let target = root.join("target.txt");
        assert!(vault
            .restore_inner(
                &reference,
                &target,
                Some(ControlledLifecycleInterruption::IntentCommitted)
            )
            .is_err());
        let current_bytes: u64 = std::fs::read_dir(&vault.dir)
            .unwrap()
            .map(|entry| entry.unwrap())
            .filter(|entry| entry.file_name() != ".admission.lock")
            .map(|entry| entry.metadata().unwrap().len())
            .sum();
        let filler = std::fs::File::create(vault.dir.join("harmless-sparse-budget")).unwrap();
        let size = 64 * 1024 * 1024 - current_bytes - 2051;
        filler.set_len(size).unwrap();
        drop(filler);
        let receipt = vault.dir.join(reference.replace(".qtn", ".qlj"));
        let intent = std::fs::read(&receipt).unwrap();
        assert!(vault.resume_restore(&reference, &target).is_err());
        assert_eq!(std::fs::read(&receipt).unwrap(), intent);
        assert!(vault.dir.join(&reference).exists());
        let filler = std::fs::OpenOptions::new()
            .write(true)
            .open(vault.dir.join("harmless-sparse-budget"))
            .unwrap();
        filler.set_len(size - 1).unwrap();
        drop(filler);
        vault.resume_restore(&reference, &target).unwrap();
        assert_eq!(
            std::fs::read(&target).unwrap(),
            b"harmless prefix boundary bytes"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn existing_reader_blocks_destructive_admission_and_source_is_preserved() {
        let root = std::env::temp_dir().join(format!("sentinel-reader-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let source = root.join("harmless.txt");
        std::fs::write(&source, b"keep while another reader holds it").unwrap();
        let reader = std::fs::File::open(&source).unwrap();
        assert!(read_bounded_handle(&source, MAX_PLAINTEXT_BYTES, true).is_err());
        assert_eq!(
            std::fs::read(&source).unwrap(),
            b"keep while another reader holds it"
        );
        drop(reader);
        let (handle, _) = read_bounded_handle(&source, MAX_PLAINTEXT_BYTES, true).unwrap();
        drop(handle);
        assert!(source.exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn interrupted_quarantine_retains_authenticated_recovery_on_both_sides_of_removal() {
        for interruption in [
            ControlledInterruption::JournalCommitted,
            ControlledInterruption::SourceDispositionApplied,
        ] {
            let root =
                std::env::temp_dir().join(format!("sentinel-interrupted-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir(&root).unwrap();
            let source = root.join("harmless.txt");
            let plaintext = b"harmless recovery interruption";
            std::fs::write(&source, plaintext).unwrap();
            let vault = Vault::new(&root.join("app"));
            let before_remove = interruption == ControlledInterruption::JournalCommitted;
            assert!(vault.quarantine_inner(&source, Some(interruption)).is_err());
            assert_eq!(source.exists(), before_remove);
            let reference = std::fs::read_dir(&vault.dir)
                .unwrap()
                .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
                .find(|name| name.ends_with(".qtn"))
                .unwrap();
            let summary = vault.recovery_summary(&reference).unwrap();
            assert_eq!(
                summary.phase,
                crate::quarantine_journal::RecoveryPhase::RecoveryRequired
            );
            assert_eq!(summary.plaintext_bytes, plaintext.len().to_string());
            let restored = root.join("explicit-new-target.txt");
            vault.restore(&reference, &restored).unwrap();
            assert_eq!(std::fs::read(&restored).unwrap(), plaintext);
            std::fs::remove_dir_all(root).unwrap();
        }
    }
}
