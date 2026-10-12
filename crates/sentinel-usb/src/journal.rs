//! Durable rollback journal over a trusted, private native file handle.
//!
//! The native broker must create/open the file with protected permissions, retained
//! no-follow ancestry and no untrusted writers or handle aliases. This module does
//! not establish path ownership, authenticate IPC, or install a recovery watchdog.
//! Checksums detect corruption, not malicious writes by a privileged principal.
use crate::recovery::{Error, Store};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};

const MAX_RECORD: usize = 4096;
const HEADER: usize = 44;
const MAGIC: &[u8; 8] = b"SNTJNL01";

/// Holds an exclusive OS file lock until dropped. No paths or record bytes are
/// exposed through Debug/serialization. A second opener must fail closed.
pub struct JournalStore {
    file: File,
}
impl JournalStore {
    /// Caller supplies the trusted private file, never a browser-selected path.
    /// Recovery must run before a new policy can be applied after every restart.
    pub fn from_trusted_file(file: File) -> Result<Self, Error> {
        file.try_lock().map_err(|_| Error::Busy)?;
        let metadata = file.metadata().map_err(|_| Error::Store)?;
        if !metadata.is_file() || metadata.len() > (HEADER + MAX_RECORD) as u64 {
            return Err(Error::Corrupt);
        }
        let mut store = Self { file };
        let mut record = [0; MAX_RECORD];
        store.load_into(&mut record)?;
        Ok(store)
    }
    fn length(&self) -> Result<usize, Error> {
        let length = self.file.metadata().map_err(|_| Error::Store)?.len();
        if length > (HEADER + MAX_RECORD) as u64 {
            return Err(Error::Corrupt);
        }
        Ok(length as usize)
    }
}
impl Store for JournalStore {
    fn persist(&mut self, record: &[u8]) -> Result<(), Error> {
        if record.is_empty() || record.len() > MAX_RECORD {
            return Err(Error::Invalid);
        }
        // Never truncate or replace an existing lease, including a partial write.
        if self.length()? != 0 {
            return Err(Error::Busy);
        }
        let mut encoded = [0u8; HEADER + MAX_RECORD];
        encoded[..8].copy_from_slice(MAGIC);
        encoded[8..12].copy_from_slice(&(record.len() as u32).to_le_bytes());
        encoded[HEADER..HEADER + record.len()].copy_from_slice(record);
        let mut digest = Sha256::new();
        digest.update(&encoded[..12]);
        digest.update(record);
        encoded[12..HEADER].copy_from_slice(&digest.finalize());
        self.file
            .seek(SeekFrom::Start(0))
            .map_err(|_| Error::Store)?;
        self.file
            .write_all(&encoded[..HEADER + record.len()])
            .map_err(|_| Error::Store)?;
        // Recovery::arm_apply cannot reach policy mutation until this succeeds.
        self.file.sync_all().map_err(|_| Error::Store)?;
        let mut verified = [0; MAX_RECORD];
        if self.load_into(&mut verified)? != Some(record.len())
            || &verified[..record.len()] != record
        {
            return Err(Error::Corrupt);
        }
        Ok(())
    }
    fn load_into(&mut self, record: &mut [u8]) -> Result<Option<usize>, Error> {
        let length = self.length()?;
        if length == 0 {
            return Ok(None);
        }
        if length <= HEADER {
            return Err(Error::Corrupt);
        }
        let mut encoded = [0; HEADER + MAX_RECORD];
        self.file
            .seek(SeekFrom::Start(0))
            .map_err(|_| Error::Store)?;
        self.file
            .read_exact(&mut encoded[..length])
            .map_err(|_| Error::Corrupt)?;
        if self.length()? != length || &encoded[..8] != MAGIC {
            return Err(Error::Corrupt);
        }
        let payload_length =
            u32::from_le_bytes(encoded[8..12].try_into().map_err(|_| Error::Corrupt)?) as usize;
        if payload_length == 0 || payload_length > MAX_RECORD || HEADER + payload_length != length {
            return Err(Error::Corrupt);
        }
        if record.len() < payload_length {
            return Err(Error::Invalid);
        }
        let mut digest = Sha256::new();
        digest.update(&encoded[..12]);
        digest.update(&encoded[HEADER..length]);
        if digest.finalize()[..] != encoded[12..HEADER] {
            return Err(Error::Corrupt);
        }
        record[..payload_length].copy_from_slice(&encoded[HEADER..length]);
        Ok(Some(payload_length))
    }
    fn clear(&mut self) -> Result<(), Error> {
        // Refuse to erase unexplained corruption; the broker must surface recovery
        // failure. Recovery invokes this only after owned restoration is verified.
        let mut record = [0; MAX_RECORD];
        self.load_into(&mut record)?;
        self.file.set_len(0).map_err(|_| Error::Store)?;
        self.file.sync_all().map_err(|_| Error::Store)?;
        if self.length()? != 0 {
            return Err(Error::Store);
        }
        Ok(())
    }
}
