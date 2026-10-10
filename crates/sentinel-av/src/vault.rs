use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use rand::RngCore;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const MAX_PLAINTEXT_BYTES: usize = 8 * 1024 * 1024;
const MAX_BLOB_BYTES: usize = MAX_PLAINTEXT_BYTES + 12 + 16;

fn read_bounded(path: &Path, limit: usize) -> Result<Vec<u8>, String> {
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
    }
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
    Ok(bytes)
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
        let plaintext = read_bounded(source, MAX_PLAINTEXT_BYTES)?;
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
        let mut output = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&vault_path)
            .map_err(|_| "quarantine blob creation failed".to_string())?;
        output
            .write_all(&blob)
            .map_err(|_| "quarantine blob write failed; original retained".to_string())?;
        output
            .sync_all()
            .map_err(|_| "quarantine blob flush failed; original retained".to_string())?;
        drop(output);

        // Verify the blob decrypts back before touching the original.
        let stored = read_bounded(&vault_path, MAX_BLOB_BYTES)?;
        let roundtrip = self.decrypt_blob(&stored, &key_bytes)?;
        if roundtrip != plaintext {
            return Err("post-encryption verification failed; original left in place".into());
        }

        let original_removed = std::fs::remove_file(source).is_ok();
        Ok(QuarantineOutcome {
            vault_file,
            original_removed,
        })
    }

    pub fn restore(&self, vault_file: &str, to_path: &Path) -> Result<(), String> {
        let vault_path = self.blob_path(vault_file)?;
        let key_bytes = self.load_key()?;
        let blob = read_bounded(&vault_path, MAX_BLOB_BYTES)?;
        let plaintext = self.decrypt_blob(&blob, &key_bytes)?;
        if let Some(parent) = to_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|_| "restore directory unavailable".to_string())?;
        }
        let mut output = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
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
        drop(output);
        std::fs::remove_file(vault_path)
            .map_err(|_| "restored; recovery blob cleanup failed".to_string())?;
        Ok(())
    }

    pub fn destroy(&self, vault_file: &str) -> Result<(), String> {
        std::fs::remove_file(self.blob_path(vault_file)?).map_err(|e| e.to_string())
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
