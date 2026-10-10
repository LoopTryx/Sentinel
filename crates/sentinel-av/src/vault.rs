use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use rand::RngCore;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

const MAX_PLAINTEXT_BYTES: usize = 8 * 1024 * 1024;
const MAX_BLOB_BYTES: usize = MAX_PLAINTEXT_BYTES + 12 + 16;

fn read_bounded(path: &Path, limit: usize) -> Result<Vec<u8>, String> {
    read_bounded_handle(path, limit, false).map(|(_, bytes)| bytes)
}

fn read_bounded_handle(
    path: &Path,
    limit: usize,
    delete_access: bool,
) -> Result<(std::fs::File, Vec<u8>), String> {
    let metadata =
        std::fs::symlink_metadata(path).map_err(|_| "quarantine input unavailable".to_string())?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > limit as u64 {
        return Err("quarantine input unsupported or exceeds byte limit".into());
    }
    let mut options = std::fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
        if metadata.file_attributes() & 0x400 != 0 {
            return Err("quarantine reparse input unsupported".into());
        }
        options.share_mode(1).custom_flags(0x00200000);
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
}

pub struct QuarantineOutcome {
    pub vault_file: String,
    pub original_removed: bool,
}

impl Vault {
    pub fn new(app_data: &Path) -> Self {
        let dir = app_data.join("vault");
        std::fs::create_dir_all(&dir).ok();
        Vault {
            dir,
            key_path: app_data.join("vault.key"),
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
            .next()
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
        let (source_handle, plaintext) = read_bounded_handle(source, MAX_PLAINTEXT_BYTES, true)?;
        let key_bytes = self.load_or_create_key()?;

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
        let vault_path = self.dir.join(&vault_file);

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
        let roundtrip = self.decrypt_blob(&stored, &key_bytes)?;
        if roundtrip != plaintext {
            return Err("post-encryption verification failed; original left in place".into());
        }

        #[cfg(windows)]
        let original_removed = mark_retained_file_for_deletion(&source_handle);
        drop(source_handle);
        drop(output);
        #[cfg(not(windows))]
        let original_removed = std::fs::remove_file(source).is_ok();
        Ok(QuarantineOutcome {
            vault_file,
            original_removed,
        })
    }

    pub fn restore(&self, vault_file: &str, to_path: &Path) -> Result<(), String> {
        let vault_path = self.blob_path(vault_file)?;
        let key_bytes = self.load_key()?;
        let (blob_handle, blob) = read_bounded_handle(&vault_path, MAX_BLOB_BYTES, true)?;
        let plaintext = self.decrypt_blob(&blob, &key_bytes)?;
        if let Some(parent) = to_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|_| "restore directory unavailable".to_string())?;
        }
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
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
        Ok(())
    }

    pub fn destroy(&self, vault_file: &str) -> Result<(), String> {
        let path = self.blob_path(vault_file)?;
        #[cfg(windows)]
        {
            let (handle, _) = read_bounded_handle(&path, MAX_BLOB_BYTES, true)?;
            if !mark_retained_file_for_deletion(&handle) {
                return Err("quarantine blob cleanup failed".into());
            }
            drop(handle);
            Ok(())
        }
        #[cfg(not(windows))]
        std::fs::remove_file(path).map_err(|e| e.to_string())
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
    use super::*;

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
}
