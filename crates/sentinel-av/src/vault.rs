use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use rand::RngCore;
use std::path::{Path, PathBuf};

/// Quarantine vault: infected files are AES-256-GCM encrypted and moved
/// out of reach, keyed by a key stored in the app-data dir. Encrypted blobs
/// are inert — nothing on the machine can execute them, and Defender
/// can't re-flag them, which keeps the quarantine list stable on stage.
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
        if let Ok(existing) = std::fs::read(&self.key_path) {
            if existing.len() == 32 {
                let mut key = [0u8; 32];
                key.copy_from_slice(&existing);
                return Ok(key);
            }
        }
        let mut key = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut key);
        std::fs::write(&self.key_path, key).map_err(|e| e.to_string())?;
        Ok(key)
    }

    /// Encrypt the file and move it into the vault. The original is deleted
    /// only after the encrypted copy is fully written and verified readable.
    pub fn quarantine(&self, source: &Path) -> Result<QuarantineOutcome, String> {
        let plaintext = std::fs::read(source).map_err(|e| e.to_string())?;
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
        std::fs::write(&vault_path, &blob).map_err(|e| e.to_string())?;

        // Verify the blob decrypts back before touching the original.
        let roundtrip = self.decrypt_blob(&blob, &key_bytes)?;
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
        let blob = std::fs::read(self.dir.join(vault_file)).map_err(|e| e.to_string())?;
        let key_bytes = self.load_or_create_key()?;
        let plaintext = self.decrypt_blob(&blob, &key_bytes)?;
        if let Some(parent) = to_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        std::fs::write(to_path, plaintext).map_err(|e| e.to_string())?;
        std::fs::remove_file(self.dir.join(vault_file)).ok();
        Ok(())
    }

    pub fn destroy(&self, vault_file: &str) -> Result<(), String> {
        std::fs::remove_file(self.dir.join(vault_file)).map_err(|e| e.to_string())
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
