use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// YARA ruleset compiled once at startup. Kept small and fast;
/// new rules go in this string (or extra-rules.yar in app data).
const YARA_RULESET: &str = r#"
rule EICAR_Antivirus_Test_File {
    strings:
        $eicar = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE"
    condition:
        $eicar
}

rule CS_Sim_Eicar {
    // Defender-independent stand-in used by Attack Simulation when the real
    // EICAR string is blocked from hitting disk by Windows Defender.
    strings:
        $m = "CS-EICAR-SIMULATION"
    condition:
        $m
}

rule Sim_Trojan_TestDropper {
    strings:
        $mark = "MALWARE-SIMULATION-PAYLOAD"
    condition:
        $mark
}

rule Suspicious_PowerShell_Encoded_Run {
    strings:
        $a = "powershell -enc" nocase
        $b = "powershell -w hidden" nocase
        $c = "-nop -w hidden -enc" nocase
    condition:
        any of them
}

rule Suspicious_Remote_Payload_Fetch {
    strings:
        $a = /https?:\/\/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/
        $b = "MSXML2.XMLHTTP" nocase
        $c = "CreateObject(\"WScript.Shell\")" nocase
    condition:
        2 of them
}

rule Suspicious_Scripted_File_Persistence {
    strings:
        $a = "CurrentVersion\\Run" nocase
        $b = "schtasks /create" nocase
        $c = "vssadmin delete shadows" nocase
    condition:
        any of them
}

rule Sim_Ransomware_Demo {
    // Defender-independent stand-in for the ransomware demo file.
    strings:
        $m = "SIM-RANSOM-DEMO"
    condition:
        $m
}

rule Ransomware_Note_Indicators {
    strings:
        $a = "your files have been encrypted" nocase
        $b = "send bitcoin" nocase
        $c = "restore point" nocase
    condition:
        2 of them
}

rule USB_AutoRun_Abuse {
    // autorun.inf that launches something on mount — classic USB vector
    strings:
        $a = "[autorun]" nocase
        $b = "open=" nocase
        $c = "shellexecute=" nocase
    condition:
        $a and 1 of ($b, $c)
}

rule Encoded_Payload_Blob {
    // script that decodes a long base64 blob at runtime
    strings:
        $a = "FromBase64String" nocase
        $b = /[A-Za-z0-9+\/]{200,}={0,2}/
    condition:
        $a and $b
}

rule Fake_Document_Macro_Lure {
    // document macro auto-run hook chained into shell execution
    strings:
        $a = "AutoOpen()" nocase
        $b = "Document_Open()" nocase
        $c = "Shell.Application" nocase
        $d = "WScript.Shell" nocase
    condition:
        ($a or $b) and 1 of ($c, $d)
}
"#;

#[derive(Debug, Clone, Serialize)]
pub struct Detection {
    pub source: String, // "hash-db" | "yara" | "heuristic"
    pub name: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanReport {
    pub path: String,
    pub sha256: String,
    pub size: u64,
    pub verdict: String, // "clean" | "suspicious" | "malicious"
    pub detections: Vec<Detection>,
    pub scan_ms: u128,
    pub state: String,
    pub bytes_inspected: u64,
    pub content_complete: bool,
    pub content_evidence: Option<crate::inspection::ContentEvidence>,
}

struct Acquisition<'a> {
    byte_budget: usize,
    retained: Option<&'a std::fs::File>,
}

pub struct Engine {
    rules: yara_x::Rules,
    admission: Mutex<()>,
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

impl Engine {
    pub fn new() -> Self {
        let mut compiler = yara_x::Compiler::new();
        compiler
            .add_source(YARA_RULESET)
            .expect("built-in YARA ruleset must compile");
        Engine {
            rules: compiler.build(),
            admission: Mutex::new(()),
        }
    }

    pub fn scan_file(
        &self,
        path: &Path,
        hash_lookup: &dyn Fn(&str) -> Option<(String, String)>,
    ) -> ScanReport {
        self.scan_file_with_control(
            path,
            hash_lookup,
            &mut || false,
            &mut |_| {},
            Instant::now() + Duration::from_secs(30),
        )
    }

    /// Read-only bounded candidate. Cooperative deadlines are not OS containment.
    /// Progress counts acquired bytes, not completed engine inspection.
    pub fn scan_file_with_control(
        &self,
        path: &Path,
        hash_lookup: &dyn Fn(&str) -> Option<(String, String)>,
        cancelled: &mut dyn FnMut() -> bool,
        progress: &mut dyn FnMut(u64),
        deadline: Instant,
    ) -> ScanReport {
        let Ok(_permit) = self.admission.try_lock() else {
            return terminal_report(path, "busy");
        };
        self.scan_file_inner(
            path,
            hash_lookup,
            cancelled,
            progress,
            deadline,
            Acquisition {
                byte_budget: 8 * 1024 * 1024,
                retained: None,
            },
        )
    }

    /// Internal selected-file acquisition. The trusted job owns the original
    /// read-only handle; a path is only the private label/heuristic context.
    pub(crate) fn scan_retained_file_with_control(
        &self,
        subject: (&Path, &std::fs::File),
        hash_lookup: &dyn Fn(&str) -> Option<(String, String)>,
        cancelled: &mut dyn FnMut() -> bool,
        progress: &mut dyn FnMut(u64),
        deadline: Instant,
    ) -> ScanReport {
        let Ok(_permit) = self.admission.try_lock() else {
            return terminal_report(subject.0, "busy");
        };
        self.scan_file_inner(
            subject.0,
            hash_lookup,
            cancelled,
            progress,
            deadline,
            Acquisition {
                byte_budget: 8 * 1024 * 1024,
                retained: Some(subject.1),
            },
        )
    }

    fn scan_file_inner(
        &self,
        path: &Path,
        hash_lookup: &dyn Fn(&str) -> Option<(String, String)>,
        cancelled: &mut dyn FnMut() -> bool,
        progress: &mut dyn FnMut(u64),
        deadline: Instant,
        acquisition: Acquisition<'_>,
    ) -> ScanReport {
        let start = Instant::now();
        let deadline = deadline.min(start + Duration::from_secs(30));
        let mut report = terminal_report(path, "failed");
        if cancelled() {
            report.state = "cancelled".into();
            return report;
        }
        if Instant::now() >= deadline {
            report.state = "timed_out".into();
            return report;
        }
        if !local_selection_path(path) {
            report.state = "unsupported".into();
            return report;
        }
        #[cfg(windows)]
        let ancestry = if acquisition.retained.is_none() {
            match crate::storage_path::retain_scan_ancestry(path, false) {
                Ok(guard) => Some(guard),
                Err(_) => return report,
            }
        } else {
            None
        };
        #[cfg(windows)]
        let read_path = if let Some(parent) = &ancestry {
            let Some(name) = path.file_name() else {
                report.state = "unsupported".into();
                return report;
            };
            parent.path.join(name)
        } else {
            path.to_path_buf()
        };
        #[cfg(not(windows))]
        let read_path = path.to_path_buf();
        let opened = if let Some(retained) = acquisition.retained {
            retained.try_clone()
        } else {
            let Ok(selected) = std::fs::symlink_metadata(&read_path) else {
                return report;
            };
            if !selected.is_file() || is_reparse(&selected) {
                report.state = "unsupported".into();
                return report;
            }
            let mut options = std::fs::OpenOptions::new();
            options.read(true);
            #[cfg(windows)]
            {
                use std::os::windows::fs::OpenOptionsExt;
                options.share_mode(1).custom_flags(0x0020_0000);
            }
            options.open(&read_path)
        };
        let Ok(mut file) = opened else {
            return report;
        };
        let Ok(before) = file.metadata() else {
            return report;
        };
        if !before.is_file() || is_reparse(&before) {
            report.state = "unsupported".into();
            return report;
        }
        let max_buf = acquisition.byte_budget.min(8 * 1024 * 1024);
        let mut buf = Vec::new();
        let size = before.len();
        report.size = size;
        let mut chunk = [0u8; 65536];
        while buf.len() < max_buf {
            if cancelled() {
                report.state = "cancelled".into();
                return report;
            }
            if Instant::now() >= deadline {
                report.state = "timed_out".into();
                return report;
            }
            let remaining = chunk.len().min(max_buf - buf.len());
            let Ok(count) = file.read(&mut chunk[..remaining]) else {
                return report;
            };
            if count == 0 {
                break;
            }
            buf.extend_from_slice(&chunk[..count]);
            progress(buf.len() as u64);
        }
        if cancelled() {
            report.state = "cancelled".into();
            return report;
        }
        if Instant::now() >= deadline {
            report.state = "timed_out".into();
            return report;
        }
        let Ok(after) = file.metadata() else {
            return report;
        };
        if before.len() != after.len()
            || before.modified().ok() != after.modified().ok()
            || (size <= max_buf as u64 && buf.len() as u64 != size)
        {
            report.state = "changed".into();
            return report;
        }
        report.bytes_inspected = buf.len() as u64;
        report.content_evidence = Some(crate::inspection::inspect_content(&buf, size));
        report.content_complete = size == report.bytes_inspected;
        report.state = if report.content_complete {
            "completed"
        } else {
            "partial"
        }
        .into();
        report.verdict = if report.content_complete {
            "clean"
        } else {
            "unknown"
        }
        .into();
        if report.content_complete {
            report.sha256 = hex::encode(Sha256::digest(&buf));
        }

        // 1. Signature hash DB (highest confidence)
        if let Some((name, severity)) = (!report.sha256.is_empty())
            .then(|| hash_lookup(&report.sha256))
            .flatten()
        {
            report.detections.push(Detection {
                source: "hash-db".into(),
                name,
                detail: format!("SHA-256 matched known-{} signature", severity),
            });
            report.verdict = severity;
        }

        // 2. EICAR plain-string check (in case hash DB is missing it)
        if !buf.is_empty()
            && window_contains(&buf, b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE")
            && !report.detections.iter().any(|d| d.name.contains("EICAR"))
        {
            report.detections.push(Detection {
                source: "heuristic".into(),
                name: "EICAR-Test-File".into(),
                detail: "EICAR antivirus test marker found in file content".into(),
            });
            report.verdict = "malicious".into();
        }

        // 3. YARA rule scan
        let mut scanner = yara_x::Scanner::new(&self.rules);
        scanner.set_timeout(deadline.saturating_duration_since(Instant::now()));
        scanner.max_matches_per_pattern(256);
        match scanner.scan(&buf) {
            Ok(results) => {
                for m in results.matching_rules() {
                    let name = m.identifier().to_string();
                    // Rules that mean "definitely bad", not just "look twice".
                    const MALICIOUS_RULES: &[&str] = &[
                        "EICAR_Antivirus_Test_File",
                        "CS_Sim_Eicar",
                        "Sim_Trojan_TestDropper",
                        "Sim_Ransomware_Demo",
                    ];
                    let severity = if MALICIOUS_RULES.contains(&name.as_str()) {
                        "malicious"
                    } else {
                        "suspicious"
                    };
                    let det = Detection {
                        source: "yara".into(),
                        name: name.clone(),
                        detail: format!("YARA rule '{}' matched file content", name),
                    };
                    if !report
                        .detections
                        .iter()
                        .any(|d| d.source == "yara" && d.name == name)
                    {
                        report.detections.push(det);
                    }
                    if severity == "malicious" {
                        report.verdict = "malicious".into();
                    } else if report.verdict != "malicious" {
                        report.verdict = "suspicious".into();
                    }
                }
            }
            Err(_) => {
                report.state = "engine_failed".into();
                report.content_complete = false;
                report.verdict = "unknown".into();
            }
        }

        let cancellation_requested = cancelled();
        if cancellation_requested || Instant::now() >= deadline {
            report.state = if cancellation_requested {
                "cancelled"
            } else {
                "timed_out"
            }
            .into();
            report.content_complete = false;
            report.verdict = "unknown".into();
            report.scan_ms = start.elapsed().as_millis();
            return report;
        }

        let evidence = report
            .content_evidence
            .as_ref()
            .expect("inspected bytes have evidence");
        if evidence.mostly_empty_large_file {
            report.detections.push(Detection {
                source: "content-inspection".into(),
                name: "LargeZeroFilledRange".into(),
                detail: format!("{} of {} inspected bytes are zero; file size {} bytes. Only the inspected range is described. Sparse images and padding may be legitimate; this is not malware proof.", evidence.zero_bytes, evidence.inspected_bytes, evidence.logical_bytes),
            });
            if report.verdict != "malicious" {
                report.verdict = "suspicious".into();
            }
        }
        if evidence.executable_header
            && path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| {
                    ["pdf", "doc", "docx", "txt", "jpg", "png"]
                        .iter()
                        .any(|expected| extension.eq_ignore_ascii_case(expected))
                })
        {
            report.detections.push(Detection {
                source: "content-inspection".into(),
                name: "DisguisedExecutableHeader".into(),
                detail: "Inspected bytes contain MZ and a bounded PE header signature despite the document/image extension. This is a format clue, not proof of malicious behavior.".into(),
            });
            if report.verdict != "malicious" {
                report.verdict = "suspicious".into();
            }
        }

        // 4. Static heuristics for files with no signature verdict
        if report.verdict != "malicious" {
            let heur = heuristic_checks(path, &buf, size);
            if let Some(det) = heur {
                report.verdict = "suspicious".into();
                report.detections.push(det);
            }
        }

        let cancellation_requested = cancelled();
        if cancellation_requested || Instant::now() >= deadline {
            report.state = if cancellation_requested {
                "cancelled"
            } else {
                "timed_out"
            }
            .into();
            report.content_complete = false;
            report.verdict = "unknown".into();
        }
        report.scan_ms = start.elapsed().as_millis();
        report
    }
}

fn terminal_report(path: &Path, state: &str) -> ScanReport {
    ScanReport {
        path: path.display().to_string(),
        sha256: String::new(),
        size: 0,
        verdict: "unknown".into(),
        detections: vec![],
        scan_ms: 0,
        state: state.into(),
        bytes_inspected: 0,
        content_complete: false,
        content_evidence: None,
    }
}

pub(crate) fn is_reparse(metadata: &std::fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        metadata.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    {
        metadata.file_type().is_symlink()
    }
}

pub(crate) fn local_selection_path(path: &Path) -> bool {
    if !path.is_absolute() {
        return false;
    }
    #[cfg(windows)]
    {
        use std::path::{Component, Prefix};
        matches!(path.components().next(), Some(Component::Prefix(prefix)) if matches!(prefix.kind(), Prefix::Disk(drive) if !drive.eq_ignore_ascii_case(&b'E')))
    }
    #[cfg(not(windows))]
    {
        true
    }
}

fn window_contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}

/// Static heuristics: filename tricks + payload entropy + script red flags.
fn heuristic_checks(path: &Path, buf: &[u8], size: u64) -> Option<Detection> {
    let name = path.file_name()?.to_string_lossy().to_lowercase();

    // Double-extension trick: invoice.pdf.exe, photo.jpg.scr
    const EXEC_EXT: &[&str] = &[
        "exe", "scr", "com", "pif", "bat", "cmd", "vbs", "js", "jar", "lnk",
    ];
    let parts: Vec<&str> = name.split('.').collect();

    // USB auto-execution config: autorun.inf that launches a payload on mount
    if name == "autorun.inf" {
        let lower = String::from_utf8_lossy(buf).to_lowercase();
        if lower.contains("open=") || lower.contains("shellexecute=") {
            return Some(Detection {
                source: "heuristic".into(),
                name: "AutoRunLauncher".into(),
                detail: "USB autorun config that launches a program when the drive is mounted"
                    .into(),
            });
        }
    }

    if parts.len() >= 3 {
        let ext = *parts.last().unwrap();
        let inner = *parts.get(parts.len() - 2).unwrap();
        const DOC_EXT: &[&str] = &[
            "pdf", "doc", "docx", "jpg", "png", "mp4", "txt", "xlsx", "ppt",
        ];
        if EXEC_EXT.contains(&ext) && DOC_EXT.contains(&inner) {
            return Some(Detection {
                source: "heuristic".into(),
                name: "DoubleExtension".into(),
                detail: format!(
                    "File masquerades as '.{}' but is executable '.{}'",
                    inner, ext
                ),
            });
        }
    }

    // Executable dropped with no version info / tiny size in a script wrapper — keep simple:
    // high-entropy executable or script referencing IPs/encoded blobs
    if EXEC_EXT.contains(parts.last().unwrap_or(&"")) && !buf.is_empty() {
        let e = entropy(buf);
        let tiny_and_weird = size < 4096 && buf.iter().any(|&b| b < 9);
        if e > 7.2 || tiny_and_weird {
            return Some(Detection {
                source: "heuristic".into(),
                name: "HighEntropyExecutable".into(),
                detail: format!("Executable with unusually high entropy ({:.2} bits/byte) — possible packed payload", e),
            });
        }
    }

    None
}

/// Shannon entropy in bits/byte (0..8)
pub fn entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }
    let mut counts = [0u64; 256];
    for &b in data {
        counts[b as usize] += 1;
    }
    let n = data.len() as f64;
    counts
        .iter()
        .filter(|&&c| c > 0)
        .map(|&c| {
            let p = c as f64 / n;
            -p * p.log2()
        })
        .sum()
}

/// Scan a directory (bounded) and return every report.
pub fn scan_directory(
    engine: &Engine,
    root: &Path,
    hash_lookup: &dyn Fn(&str) -> Option<(String, String)>,
) -> Vec<ScanReport> {
    scan_directory_with_control(
        engine,
        root,
        hash_lookup,
        &mut || false,
        &mut |_, _| {},
        Instant::now() + Duration::from_secs(30),
    )
}

/// One admitted scan per Engine; callers use the application singleton.
/// Directory findings include explicit terminal records for incomplete traversal.
/// No path/content callback may be forwarded into AI or public diagnostics.
pub fn scan_directory_with_control(
    engine: &Engine,
    root: &Path,
    hash_lookup: &dyn Fn(&str) -> Option<(String, String)>,
    cancelled: &mut dyn FnMut() -> bool,
    progress: &mut dyn FnMut(&Path, u64),
    deadline: Instant,
) -> Vec<ScanReport> {
    scan_directory_inner(
        engine,
        root,
        hash_lookup,
        cancelled,
        progress,
        deadline,
        None,
    )
}

/// Trusted job retains the originally selected directory's volume address.
/// The ordinary path is a private report label, never acquisition authority.
#[cfg(windows)]
pub(crate) fn scan_retained_directory_with_control(
    engine: &Engine,
    subject: (&Path, &crate::storage_path::DirectoryGuard),
    hash_lookup: &dyn Fn(&str) -> Option<(String, String)>,
    cancelled: &mut dyn FnMut() -> bool,
    progress: &mut dyn FnMut(&Path, u64),
    deadline: Instant,
) -> Vec<ScanReport> {
    scan_directory_inner(
        engine,
        subject.0,
        hash_lookup,
        cancelled,
        progress,
        deadline,
        Some(subject.1),
    )
}

fn scan_directory_inner(
    engine: &Engine,
    root: &Path,
    hash_lookup: &dyn Fn(&str) -> Option<(String, String)>,
    cancelled: &mut dyn FnMut() -> bool,
    progress: &mut dyn FnMut(&Path, u64),
    deadline: Instant,
    retained_root: Option<&crate::storage_path::DirectoryGuard>,
) -> Vec<ScanReport> {
    if cancelled() {
        return vec![terminal_report(root, "cancelled")];
    }
    if !local_selection_path(root) {
        return vec![terminal_report(root, "unsupported")];
    }
    let Ok(_permit) = engine.admission.try_lock() else {
        return vec![terminal_report(root, "busy")];
    };
    if Instant::now() >= deadline {
        return vec![terminal_report(root, "timed_out")];
    }
    #[cfg(windows)]
    let acquired_root = if retained_root.is_none() {
        match crate::storage_path::retain_scan_ancestry(root, true) {
            Ok(guard) => Some(guard),
            Err(_) => return vec![terminal_report(root, "access_error")],
        }
    } else {
        None
    };
    #[cfg(windows)]
    let read_root = &retained_root
        .or(acquired_root.as_ref())
        .expect("retained scan root")
        .path;
    #[cfg(not(windows))]
    let read_root = {
        let _ = retained_root;
        root
    };
    let mut reports = Vec::new();
    let deadline = deadline.min(Instant::now() + Duration::from_secs(30));
    let mut bytes = 0;
    let mut visited = 0;
    let mut entries = walkdir::WalkDir::new(read_root)
        .max_depth(6)
        // Keep every permitted depth open. A smaller WalkDir max_open causes
        // eager collection of an ancestor's remaining entries, bypassing our
        // entry/memory budget. Root plus six levels needs at most seven handles.
        .max_open(7)
        .follow_links(false)
        .follow_root_links(false)
        .into_iter();
    loop {
        if cancelled() {
            reports.push(terminal_report(root, "cancelled"));
            break;
        }
        if Instant::now() >= deadline {
            reports.push(terminal_report(root, "timed_out"));
            break;
        }
        if reports.len() >= 64 || bytes >= 64 * 1024 * 1024 || visited >= 256 {
            reports.push(terminal_report(root, "limit_reached"));
            break;
        }
        let Some(entry) = entries.next() else {
            break;
        };
        visited += 1;
        if Instant::now() >= deadline {
            reports.push(terminal_report(root, "timed_out"));
            break;
        }
        let Ok(entry) = entry else {
            reports.push(terminal_report(root, "access_error"));
            continue;
        };
        let Ok(relative) = entry.path().strip_prefix(read_root) else {
            reports.push(terminal_report(root, "access_error"));
            break;
        };
        let report_path = root.join(relative);
        if entry.file_type().is_symlink() {
            reports.push(terminal_report(&report_path, "unsupported"));
            continue;
        }
        if entry.depth() == 6 && entry.file_type().is_dir() {
            reports.push(terminal_report(&report_path, "depth_limit"));
        }
        if entry.file_type().is_file() {
            if cancelled() {
                reports.push(terminal_report(root, "cancelled"));
                break;
            }
            if Instant::now() >= deadline {
                reports.push(terminal_report(root, "timed_out"));
                break;
            }
            #[cfg(windows)]
            let child_subject = match open_enumerated_file(entry.path()) {
                Ok(subject) => subject,
                Err(_) => {
                    reports.push(terminal_report(&report_path, "access_error"));
                    continue;
                }
            };
            #[cfg(windows)]
            let retained = Some(&child_subject.1);
            #[cfg(not(windows))]
            let retained = None;
            let remaining = (64 * 1024 * 1024 - bytes) as usize;
            let mut acquired = 0;
            let report = engine.scan_file_inner(
                &report_path,
                hash_lookup,
                cancelled,
                &mut |count| {
                    acquired = count;
                    progress(&report_path, count);
                },
                deadline,
                Acquisition {
                    byte_budget: remaining,
                    retained,
                },
            );
            bytes += acquired;
            reports.push(report);
        }
    }
    reports
}

#[cfg(windows)]
fn open_enumerated_file(
    path: &Path,
) -> Result<(crate::storage_path::DirectoryGuard, std::fs::File), String> {
    use std::os::windows::fs::OpenOptionsExt;
    let parent = crate::storage_path::retain_scan_child_parent(path)?;
    let name = path.file_name().ok_or("enumerated filename unavailable")?;
    let file = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(1)
        .custom_flags(0x0020_0000)
        .open(parent.path.join(name))
        .map_err(|_| "enumerated subject unavailable")?;
    Ok((parent, file))
}
