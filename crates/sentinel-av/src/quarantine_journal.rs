//! Native-only encrypted recovery bookkeeping; summaries grant no action authority.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::{Path, PathBuf};

const MAGIC: &[u8; 4] = b"SQJ1";
const MAX_RECORD: usize = 2048;
const MAX_JOURNAL: usize = 8192;

#[derive(Debug, PartialEq, Eq)]
pub enum RecoveryPhase {
    RemovalRecorded,
    SourceRetainedRecorded,
    RestoredRecorded,
    DestroyedRecorded,
    RecoveryRequired,
}

#[derive(Debug, PartialEq, Eq)]
pub enum RecoveryIntent {
    Quarantine,
    Restore,
    Destroy,
}

#[derive(Debug, PartialEq, Eq)]
pub struct RecoverySummary {
    pub vault_file: String,
    pub phase: RecoveryPhase,
    pub intent: RecoveryIntent,
    pub plaintext_bytes: String,
    pub sha256: String,
}

#[derive(Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum Stage {
    VerifiedBeforeRemoval,
    RemovalRecorded,
    SourceRetainedRecorded,
    RestorePrepared,
    DestroyPrepared,
    RestoredRecorded,
    DestroyedRecorded,
}

// Never derive Debug: the private source association is encrypted on disk and
// must not enter diagnostics or public/browser reports.
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    source: String,
    sha256: String,
    bytes: u64,
    stage: Stage,
}

pub(crate) struct Journal {
    file: std::fs::File,
    reference: String,
    record: Record,
}

fn journal_path(dir: &Path, reference: &str, lifecycle: bool) -> Result<PathBuf, String> {
    let id = reference
        .strip_suffix(".qtn")
        .ok_or("invalid recovery reference")?;
    if id.len() != 32
        || !id
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err("invalid recovery reference".into());
    }
    Ok(dir.join(format!("{id}.{}", if lifecycle { "qlj" } else { "qjr" })))
}

impl Journal {
    pub(crate) fn resume_lifecycle(
        dir: &Path,
        reference: &str,
        association: &Path,
        plaintext: &[u8],
        key: &[u8; 32],
        destroy: bool,
    ) -> Result<Self, String> {
        let (file, bytes) =
            crate::vault::read_bounded_mutable(&journal_path(dir, reference, true)?, MAX_JOURNAL)?;
        // Resume only an exact, complete single intent. Never truncate/replace
        // torn tails or reinterpret a completed/different action as admission.
        if bytes.get(..4) != Some(MAGIC.as_slice()) || bytes.len() < 8 {
            return Err("recovery intent invalid".into());
        }
        let length = u32::from_be_bytes(
            bytes[4..8]
                .try_into()
                .map_err(|_| "recovery intent invalid")?,
        ) as usize;
        if !(29..=MAX_RECORD).contains(&length) || bytes.len() != 8 + length {
            return Err("recovery intent incomplete or already terminal".into());
        }
        let frame = &bytes[8..];
        let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "recovery journal key failed")?;
        let clear = cipher
            .decrypt(
                Nonce::from_slice(&frame[..12]),
                Payload {
                    msg: &frame[12..],
                    aad: reference.as_bytes(),
                },
            )
            .map_err(|_| "recovery intent unauthenticated")?;
        let record: Record =
            serde_json::from_slice(&clear).map_err(|_| "recovery intent invalid")?;
        let expected = if destroy {
            Stage::DestroyPrepared
        } else {
            Stage::RestorePrepared
        };
        if record.stage != expected
            || !association.is_absolute()
            || record.source.len() > 1024
            || record.source.contains('\0')
            || association.to_str() != Some(record.source.as_str())
            || plaintext.len() > 8 * 1024 * 1024
            || record.bytes != plaintext.len() as u64
            || record.sha256 != hex::encode(Sha256::digest(plaintext))
        {
            return Err("recovery intent subject or byte identity mismatch".into());
        }
        // read_bounded_mutable leaves the retained handle at EOF for append.
        Ok(Self {
            file,
            reference: reference.into(),
            record,
        })
    }

    pub(crate) fn create(
        dir: &Path,
        reference: &str,
        source: &Path,
        bytes: &[u8],
        key: &[u8; 32],
    ) -> Result<Self, String> {
        Self::create_record(
            dir,
            reference,
            source,
            bytes,
            key,
            Stage::VerifiedBeforeRemoval,
        )
    }

    pub(crate) fn prepare_lifecycle(
        dir: &Path,
        reference: &str,
        association: &Path,
        bytes: &[u8],
        key: &[u8; 32],
        destroy: bool,
    ) -> Result<Self, String> {
        Self::create_record(
            dir,
            reference,
            association,
            bytes,
            key,
            if destroy {
                Stage::DestroyPrepared
            } else {
                Stage::RestorePrepared
            },
        )
    }

    fn create_record(
        dir: &Path,
        reference: &str,
        source: &Path,
        bytes: &[u8],
        key: &[u8; 32],
        stage: Stage,
    ) -> Result<Self, String> {
        let source_text = source.to_str().ok_or("recovery source unsupported")?;
        if !source.is_absolute() || source_text.len() > 1024 || source_text.contains('\0') {
            return Err("recovery source unsupported".into());
        }
        let record = Record {
            source: source_text.to_owned(),
            sha256: hex::encode(Sha256::digest(bytes)),
            bytes: bytes.len() as u64,
            stage,
        };
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(0).custom_flags(0x00200000);
        }
        let file = options
            .open(journal_path(
                dir,
                reference,
                record.stage != Stage::VerifiedBeforeRemoval,
            )?)
            .map_err(|_| "recovery journal creation failed; source retained".to_string())?;
        crate::storage_privacy::validate_file(&file)?;
        let mut journal = Self {
            file,
            reference: reference.into(),
            record,
        };
        journal
            .file
            .write_all(MAGIC)
            .map_err(|_| "recovery journal write failed; source retained".to_string())?;
        journal.append(key)?;
        Ok(journal)
    }

    pub(crate) fn finish(&mut self, removed: bool, key: &[u8; 32]) -> Result<(), String> {
        self.record.stage = if removed {
            Stage::RemovalRecorded
        } else {
            Stage::SourceRetainedRecorded
        };
        self.append(key)
    }

    pub(crate) fn finish_lifecycle(&mut self, key: &[u8; 32]) -> Result<(), String> {
        self.record.stage = match self.record.stage {
            Stage::RestorePrepared => Stage::RestoredRecorded,
            Stage::DestroyPrepared => Stage::DestroyedRecorded,
            _ => return Err("invalid recovery lifecycle transition".into()),
        };
        self.append(key)
    }

    fn append(&mut self, key: &[u8; 32]) -> Result<(), String> {
        let plain =
            serde_json::to_vec(&self.record).map_err(|_| "recovery journal encoding failed")?;
        if plain.len() + 28 > MAX_RECORD {
            return Err("recovery journal record exceeds limit".into());
        }
        let mut nonce = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce);
        let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "recovery journal key failed")?;
        let sealed = cipher
            .encrypt(
                Nonce::from_slice(&nonce),
                Payload {
                    msg: &plain,
                    aad: self.reference.as_bytes(),
                },
            )
            .map_err(|_| "recovery journal encryption failed")?;
        let length = nonce.len() + sealed.len();
        let current = self
            .file
            .metadata()
            .map_err(|_| "recovery journal metadata failed")?
            .len();
        if current + 4 + length as u64 > MAX_JOURNAL as u64 {
            return Err("recovery journal exceeds limit".into());
        }
        self.file
            .write_all(&(length as u32).to_be_bytes())
            .and_then(|_| self.file.write_all(&nonce))
            .and_then(|_| self.file.write_all(&sealed))
            .and_then(|_| self.file.sync_all())
            .map_err(|_| "recovery journal commit failed; recovery required".to_string())
    }
}

pub(crate) fn read_native_record(
    dir: &Path,
    reference: &str,
    key: &[u8; 32],
) -> Result<(RecoverySummary, PathBuf), String> {
    let lifecycle_path = journal_path(dir, reference, true)?;
    // A malformed/inaccessible lifecycle receipt must never fall back to the
    // older quarantine receipt and falsely imply it describes the latest action.
    let lifecycle = match std::fs::symlink_metadata(&lifecycle_path) {
        Ok(_) => true,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(_) => return Err("recovery lifecycle unavailable".into()),
    };
    let bytes = crate::vault::read_bounded(&journal_path(dir, reference, lifecycle)?, MAX_JOURNAL)?;
    if bytes.get(..4) != Some(MAGIC.as_slice()) {
        return Err("recovery journal invalid".into());
    }
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "recovery journal key failed")?;
    let mut offset = 4;
    let mut first: Option<Record> = None;
    let mut phase = RecoveryPhase::RecoveryRequired;
    let mut records = 0;
    while offset < bytes.len() {
        let Some(length_bytes) = bytes.get(offset..offset + 4) else {
            phase = RecoveryPhase::RecoveryRequired;
            break;
        };
        let length = u32::from_be_bytes(
            length_bytes
                .try_into()
                .map_err(|_| "recovery journal invalid")?,
        ) as usize;
        offset += 4;
        if !(29..=MAX_RECORD).contains(&length) || records >= 2 {
            phase = RecoveryPhase::RecoveryRequired;
            break;
        }
        let Some(frame) = bytes.get(offset..offset + length) else {
            phase = RecoveryPhase::RecoveryRequired;
            break;
        };
        let plain = match cipher.decrypt(
            Nonce::from_slice(&frame[..12]),
            Payload {
                msg: &frame[12..],
                aad: reference.as_bytes(),
            },
        ) {
            Ok(plain) => plain,
            Err(_) => {
                phase = RecoveryPhase::RecoveryRequired;
                break;
            }
        };
        let record: Record = match serde_json::from_slice(&plain) {
            Ok(record) => record,
            Err(_) => {
                phase = RecoveryPhase::RecoveryRequired;
                break;
            }
        };
        if record.bytes > 8 * 1024 * 1024
            || record.source.len() > 1024
            || !Path::new(&record.source).is_absolute()
            || record.source.contains('\0')
            || record.sha256.len() != 64
            || !record
                .sha256
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            phase = RecoveryPhase::RecoveryRequired;
            break;
        }
        if let Some(initial) = &first {
            if initial.source != record.source
                || initial.sha256 != record.sha256
                || initial.bytes != record.bytes
                || !matches!(
                    (&initial.stage, &record.stage),
                    (
                        Stage::VerifiedBeforeRemoval,
                        Stage::RemovalRecorded | Stage::SourceRetainedRecorded
                    ) | (Stage::RestorePrepared, Stage::RestoredRecorded)
                        | (Stage::DestroyPrepared, Stage::DestroyedRecorded)
                )
            {
                phase = RecoveryPhase::RecoveryRequired;
                break;
            }
            phase = match record.stage {
                Stage::RemovalRecorded => RecoveryPhase::RemovalRecorded,
                Stage::SourceRetainedRecorded => RecoveryPhase::SourceRetainedRecorded,
                Stage::RestoredRecorded => RecoveryPhase::RestoredRecorded,
                Stage::DestroyedRecorded => RecoveryPhase::DestroyedRecorded,
                _ => RecoveryPhase::RecoveryRequired,
            };
        } else {
            if if lifecycle {
                !matches!(
                    record.stage,
                    Stage::RestorePrepared | Stage::DestroyPrepared
                )
            } else {
                record.stage != Stage::VerifiedBeforeRemoval
            } {
                break;
            }
            first = Some(record);
        }
        records += 1;
        offset += length;
    }
    let record = first.ok_or("recovery journal unauthenticated or incomplete")?;
    Ok((
        RecoverySummary {
            vault_file: reference.into(),
            phase,
            intent: match record.stage {
                Stage::VerifiedBeforeRemoval => RecoveryIntent::Quarantine,
                Stage::RestorePrepared => RecoveryIntent::Restore,
                Stage::DestroyPrepared => RecoveryIntent::Destroy,
                _ => return Err("invalid recovery intent".into()),
            },
            plaintext_bytes: record.bytes.to_string(),
            sha256: record.sha256,
        },
        PathBuf::from(record.source),
    ))
}

pub(crate) fn read_summary(
    dir: &Path,
    reference: &str,
    key: &[u8; 32],
) -> Result<RecoverySummary, String> {
    read_native_record(dir, reference, key).map(|(summary, _)| summary)
}
