use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;

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
}

pub struct Engine {
    rules: yara_x::Rules,
}

impl Engine {
    pub fn new() -> Self {
        let mut compiler = yara_x::Compiler::new();
        compiler
            .add_source(YARA_RULESET)
            .expect("built-in YARA ruleset must compile");
        Engine {
            rules: compiler.build(),
        }
    }

    pub fn scan_file(&self, path: &Path, hash_lookup: &dyn Fn(&str) -> Option<(String, String)>) -> ScanReport {
        let start = std::time::Instant::now();
        let mut report = ScanReport {
            path: path.display().to_string(),
            sha256: String::new(),
            size: 0,
            verdict: "clean".into(),
            detections: vec![],
            scan_ms: 0,
        };

        let Ok(mut file) = std::fs::File::open(path) else {
            report.detections.push(Detection {
                source: "heuristic".into(),
                name: "Unreadable".into(),
                detail: "File could not be opened for scanning".into(),
            });
            report.verdict = "suspicious".into();
            report.scan_ms = start.elapsed().as_millis();
            return report;
        };

        // Cap read at 64 MB — demo-day USB sticks won't exceed this, and it
        // keeps scans instant. Larger files are hashed from a streaming read.
        const MAX_BUF: u64 = 64 * 1024 * 1024;
        let mut buf = Vec::new();
        let size = file.metadata().map(|m| m.len()).unwrap_or(0);
        report.size = size;
        let _ = (&mut file).take(MAX_BUF).read_to_end(&mut buf);

        let mut hasher = Sha256::new();
        hasher.update(&buf);
        if size > MAX_BUF {
            let _ = std::io::copy(&mut file, &mut hasher);
        }
        report.sha256 = hex::encode(hasher.finalize());

        // 1. Signature hash DB (highest confidence)
        if let Some((name, severity)) = hash_lookup(&report.sha256) {
            report.detections.push(Detection {
                source: "hash-db".into(),
                name,
                detail: format!("SHA-256 matched known-{} signature", severity),
            });
            report.verdict = severity;
        }

        // 2. EICAR plain-string check (in case hash DB is missing it)
        if !buf.is_empty() && window_contains(&buf, b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE") {
            if !report.detections.iter().any(|d| d.name.contains("EICAR")) {
                report.detections.push(Detection {
                    source: "heuristic".into(),
                    name: "EICAR-Test-File".into(),
                    detail: "EICAR antivirus test marker found in file content".into(),
                });
                report.verdict = "malicious".into();
            }
        }

        // 3. YARA rule scan
        let mut scanner = yara_x::Scanner::new(&self.rules);
        if let Ok(results) = scanner.scan(&buf) {
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
                } else if report.verdict == "clean" {
                    report.verdict = "suspicious".into();
                }
            }
        }

        // 4. Static heuristics for files with no signature verdict
        if report.verdict == "clean" {
            let heur = heuristic_checks(path, &buf, size);
            if let Some(det) = heur {
                report.verdict = "suspicious".into();
                report.detections.push(det);
            }
        }

        report.scan_ms = start.elapsed().as_millis();
        report
    }
}

fn window_contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}

/// Static heuristics: filename tricks + payload entropy + script red flags.
fn heuristic_checks(path: &Path, buf: &[u8], size: u64) -> Option<Detection> {
    let name = path.file_name()?.to_string_lossy().to_lowercase();

    // Double-extension trick: invoice.pdf.exe, photo.jpg.scr
    const EXEC_EXT: &[&str] = &["exe", "scr", "com", "pif", "bat", "cmd", "vbs", "js", "jar", "lnk"];
    let parts: Vec<&str> = name.split('.').collect();

    // USB auto-execution config: autorun.inf that launches a payload on mount
    if name == "autorun.inf" {
        let lower = String::from_utf8_lossy(buf).to_lowercase();
        if lower.contains("open=") || lower.contains("shellexecute=") {
            return Some(Detection {
                source: "heuristic".into(),
                name: "AutoRunLauncher".into(),
                detail: "USB autorun config that launches a program when the drive is mounted".into(),
            });
        }
    }

    if parts.len() >= 3 {
        let ext = *parts.last().unwrap();
        let inner = *parts.get(parts.len() - 2).unwrap();
        const DOC_EXT: &[&str] = &["pdf", "doc", "docx", "jpg", "png", "mp4", "txt", "xlsx", "ppt"];
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
    if EXEC_EXT.contains(&parts.last().unwrap_or(&"")) && !buf.is_empty() {
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
    let mut reports = Vec::new();
    for entry in walkdir::WalkDir::new(root)
        .max_depth(6)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
    {
        if entry.file_type().is_file() {
            reports.push(engine.scan_file(entry.path(), hash_lookup));
        }
    }
    reports
}
