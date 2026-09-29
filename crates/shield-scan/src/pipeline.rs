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

#[derive(Clone, Copy, Debug)]
pub struct DirectoryLimits {
    pub max_entries: u64,
    pub max_depth: u32,
    pub max_pending_dirs: usize,
    pub max_findings: usize,
}

impl Default for DirectoryLimits {
    fn default() -> Self {
        Self {
            max_entries: 100_000,
            max_depth: 16,
            max_pending_dirs: 4_096,
            max_findings: 1_000,
        }
    }
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
    Cancelled,
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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileFinding {
    pub relative_path: String,
    pub state: ScanState,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryReport {
    pub complete: bool,
    pub cancelled: bool,
    pub limit_reached: bool,
    pub entries_visited: u64,
    pub files_visited: u64,
    pub files_checked: u64,
    pub files_skipped: u64,
    pub access_errors: u64,
    pub engine_failures: u64,
    pub bytes_read: u64,
    pub full_signature_engine_active: bool,
    pub findings: Vec<FileFinding>,
}

impl DirectoryReport {
    fn new() -> Self {
        Self {
            complete: false,
            cancelled: false,
            limit_reached: false,
            entries_visited: 0,
            files_visited: 0,
            files_checked: 0,
            files_skipped: 0,
            access_errors: 0,
            engine_failures: 0,
            bytes_read: 0,
            full_signature_engine_active: false,
            findings: Vec::new(),
        }
    }
}

/// Traverses one chosen directory without following reparse points or symlinks.
/// Cancellation is checked between entries and between read chunks.
pub fn scan_directory(
    root: impl AsRef<Path>,
    file_limits: ScanLimits,
    directory_limits: DirectoryLimits,
    mut cancelled: impl FnMut() -> bool,
) -> DirectoryReport {
    let root = root.as_ref();
    let mut report = DirectoryReport::new();
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(_) => {
            report.access_errors = 1;
            return report;
        }
    };
    if !metadata.is_dir() || is_reparse_point(&metadata) {
        report.files_skipped = 1;
        return report;
    }
    let mut pending = vec![(root.to_path_buf(), 0u32)];
    while let Some((directory, depth)) = pending.pop() {
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) => {
                report.access_errors += 1;
                continue;
            }
        };
        for entry in entries {
            if cancelled() {
                report.cancelled = true;
                return report;
            }
            if report.entries_visited >= directory_limits.max_entries {
                report.limit_reached = true;
                return report;
            }
            report.entries_visited += 1;
            let entry = match entry {
                Ok(entry) => entry,
                Err(_) => {
                    report.access_errors += 1;
                    continue;
                }
            };
            let metadata = match fs::symlink_metadata(entry.path()) {
                Ok(metadata) => metadata,
                Err(_) => {
                    report.access_errors += 1;
                    continue;
                }
            };
            if is_reparse_point(&metadata) || metadata.file_type().is_symlink() {
                report.files_skipped += 1;
                continue;
            }
            if metadata.is_dir() {
                if depth >= directory_limits.max_depth
                    || pending.len() >= directory_limits.max_pending_dirs
                {
                    report.limit_reached = true;
                    report.files_skipped += 1;
                } else {
                    pending.push((entry.path(), depth + 1));
                }
                continue;
            }
            if !metadata.is_file() {
                report.files_skipped += 1;
                continue;
            }
            let result = scan_file_with_cancel(entry.path(), file_limits, &mut cancelled);
            report.files_visited += result.files_visited;
            report.files_checked += result.files_checked;
            report.files_skipped += result.files_skipped;
            report.access_errors += result.access_errors;
            report.engine_failures += result.engine_failures;
            report.bytes_read += result.bytes_read;
            if result.state == ScanState::Cancelled {
                report.cancelled = true;
                return report;
            }
            if result.state == ScanState::TestSignatureFound {
                if report.findings.len() >= directory_limits.max_findings {
                    report.limit_reached = true;
                    return report;
                }
                let relative_path = entry
                    .path()
                    .strip_prefix(root)
                    .unwrap_or(entry.path().as_path())
                    .to_string_lossy()
                    .replace('\\', "/");
                report.findings.push(FileFinding {
                    relative_path,
                    state: result.state,
                });
            }
        }
    }
    report.complete = !report.limit_reached
        && report.files_skipped == 0
        && report.access_errors == 0
        && report.engine_failures == 0;
    report
}

#[cfg(windows)]
fn is_reparse_point(metadata: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    metadata.file_attributes() & 0x400 != 0
}

#[cfg(not(windows))]
fn is_reparse_point(metadata: &Metadata) -> bool {
    metadata.file_type().is_symlink()
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
    scan_file_with_cancel(path, limits, &mut || false)
}

fn scan_file_with_cancel(
    path: impl AsRef<Path>,
    limits: ScanLimits,
    cancelled: &mut impl FnMut() -> bool,
) -> ScanResult {
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
        if cancelled() {
            return result.skip(ScanState::Cancelled);
        }
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
