use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File, Metadata};
use std::io::Read;
use std::path::Path;

const EICAR: &[u8] = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
const READ_CHUNK_BYTES: usize = 8192;

#[derive(Clone, Copy, Debug)]
pub struct ScanLimits {
    pub max_file_bytes: u64,
}

impl Default for ScanLimits {
    fn default() -> Self {
        Self {
            max_file_bytes: 512 * 1024 * 1024,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ScanState {
    NoKnownFinding,
    TestSignatureFound,
    SkippedLimit,
    SkippedUnsupported,
    AccessError,
    ChangedDuringScan,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub state: ScanState,
    pub bytes_read: u64,
    pub sha256: Option<String>,
    pub files_visited: u64,
    pub files_checked: u64,
    pub files_skipped: u64,
    pub access_errors: u64,
    pub engine_failures: u64,
    pub full_signature_engine_active: bool,
}

impl ScanResult {
    fn with_state(state: ScanState) -> Self {
        Self {
            state,
            bytes_read: 0,
            sha256: None,
            files_visited: 1,
            files_checked: 0,
            files_skipped: 0,
            access_errors: 0,
            engine_failures: 0,
            full_signature_engine_active: false,
        }
    }

    fn skip(mut self, state: ScanState) -> Self {
        self.state = state;
        self.files_skipped = 1;
        self
    }

    fn error(mut self) -> Self {
        self.state = ScanState::AccessError;
        self.access_errors = 1;
        self
    }
}

/// Local read-only probe. The full signature engine, archive inspection, isolation,
/// and durable scan jobs are not present; callers must present partial coverage.
pub fn scan_file(path: impl AsRef<Path>, limits: ScanLimits) -> ScanResult {
    let path = path.as_ref();
    let mut result = ScanResult::with_state(ScanState::NoKnownFinding);
    let initial = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => return result.error(),
    };
    if !initial.file_type().is_file() {
        return result.skip(ScanState::SkippedUnsupported);
    }
    if initial.len() > limits.max_file_bytes {
        return result.skip(ScanState::SkippedLimit);
    }
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(_) => return result.error(),
    };
    let opened = match file.metadata() {
        Ok(metadata) => metadata,
        Err(_) => return result.error(),
    };
    if !same_basic_identity(&initial, &opened) {
        return result.skip(ScanState::ChangedDuringScan);
    }
    let mut digest = Sha256::new();
    let mut buffer = [0u8; READ_CHUNK_BYTES];
    let mut tail = Vec::with_capacity(EICAR.len() - 1);
    let mut found_test_signature = false;
    loop {
        let read = match file.read(&mut buffer) {
            Ok(read) => read,
            Err(_) => return result.error(),
        };
        if read == 0 {
            break;
        }
        result.bytes_read += read as u64;
        if result.bytes_read > limits.max_file_bytes {
            return result.skip(ScanState::SkippedLimit);
        }
        digest.update(&buffer[..read]);
        tail.extend_from_slice(&buffer[..read]);
        if tail.windows(EICAR.len()).any(|window| window == EICAR) {
            found_test_signature = true;
        }
        let retain = tail.len().min(EICAR.len() - 1);
        tail.drain(..tail.len() - retain);
    }
    let final_metadata = match file.metadata() {
        Ok(metadata) => metadata,
        Err(_) => return result.error(),
    };
    if !same_basic_identity(&opened, &final_metadata) || result.bytes_read != opened.len() {
        return result.skip(ScanState::ChangedDuringScan);
    }
    result.sha256 = Some(format!("{:x}", digest.finalize()));
    result.files_checked = 1;
    if found_test_signature {
        result.state = ScanState::TestSignatureFound;
    }
    result
}

fn same_basic_identity(left: &Metadata, right: &Metadata) -> bool {
    left.len() == right.len() && left.modified().ok() == right.modified().ok()
}
