use crate::engine::{entropy, scan_directory, Engine};
use crate::vault::Vault;
use std::path::{Path, PathBuf};

const EICAR: &str = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
const SIM_EICAR: &str = "CS-EICAR-SIMULATION :: Cyber Shield live demo payload :: detected by YARA rule CS_Sim_Eicar";

fn hash_lookup(h: &str) -> Option<(String, String)> {
    // EICAR's well-known SHA-256, as seeded into the signature DB
    match h {
        "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f" => {
            Some(("EICAR-Test-File".into(), "malicious".into()))
        }
        _ => None,
    }
}

/// Write a malicious payload that survives Windows Defender real-time
/// scanning. The real EICAR string is blocked from disk (OS error 225) on
/// machines with Defender active, so we detect that and use the CS
/// simulation marker, which our YARA engine also flags as malicious.
fn write_malicious(file: &Path) -> String {
    if std::fs::write(file, EICAR).is_ok()
        && std::fs::read(file).map(|b| b == EICAR.as_bytes()).unwrap_or(false)
    {
        return "eicar".into();
    }
    std::fs::write(file, SIM_EICAR).expect("sim marker must be writable");
    "sim".into()
}

fn tmpdir(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("cs-test-{}-{}", name, std::process::id()));
    std::fs::create_dir_all(&d).unwrap();
    d
}

#[test]
fn detects_eicar_file() {
    let dir = tmpdir("eicar");
    let file = dir.join("eicar_test.com");
    let flavor = write_malicious(&file);

    let engine = Engine::new();
    let report = engine.scan_file(&file, &hash_lookup);
    assert_eq!(
        report.verdict, "malicious",
        "EICAR (or its sim marker) must be malicious"
    );
    let det_name = if flavor == "eicar" { "EICAR" } else { "CS_Sim" };
    assert!(
        report
            .detections
            .iter()
            .any(|d| d.name.contains(det_name)),
        "detection must be named (wanted {}), got: {:?}",
        det_name,
        report.detections
    );
    assert!(report.sha256.len() == 64);
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn clean_file_passes() {
    let dir = tmpdir("clean");
    let file = dir.join("notes.txt");
    std::fs::write(&file, "hello world, this is a perfectly normal text file").unwrap();

    let engine = Engine::new();
    let report = engine.scan_file(&file, &hash_lookup);
    assert_eq!(report.verdict, "clean", "plain text must be clean");
    assert!(report.detections.is_empty());
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn catches_double_extension_trick() {
    let dir = tmpdir("doubleext");
    let file = dir.join("invoice.pdf.exe");
    // bogus exe-ish bytes, low content signal — filename heuristic must fire
    std::fs::write(&file, vec![0x4D, 0x5A, 1, 2, 3, 4, 5]).unwrap();

    let engine = Engine::new();
    let report = engine.scan_file(&file, &hash_lookup);
    assert_eq!(report.verdict, "suspicious");
    assert!(
        report
            .detections
            .iter()
            .any(|d| d.name == "DoubleExtension"),
        "double-extension heuristic must fire"
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn yara_flags_encoded_powershell() {
    let dir = tmpdir("ps");
    let file = dir.join("dropper.bat");
    std::fs::write(&file, "powershell -enc SQBFAFQAUgBZAFQATwBOAC0AVABFAFMAVA==").unwrap();

    let engine = Engine::new();
    let report = engine.scan_file(&file, &hash_lookup);
    assert_eq!(report.verdict, "suspicious");
    assert!(
        report
            .detections
            .iter()
            .any(|d| d.source == "yara" && d.name.contains("PowerShell")),
        "YARA encoded-powershell rule must fire"
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn scan_directory_reports_all_files() {
    let dir = tmpdir("dirscan");
    std::fs::write(dir.join("a.txt"), "normal").unwrap();
    write_malicious(&dir.join("b.com"));
    std::fs::create_dir_all(dir.join("sub")).unwrap();
    std::fs::write(dir.join("sub").join("c.txt"), "more normal").unwrap();

    let engine = Engine::new();
    let reports = scan_directory(&engine, &dir, &hash_lookup);
    assert_eq!(reports.len(), 3, "all files in tree must be scanned");
    let bad = reports.iter().find(|r| r.verdict == "malicious");
    assert!(
        bad.is_some(),
        "malicious file inside subdirectory must be caught"
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn vault_roundtrip_encrypts_and_restores() {
    let base = tmpdir("vault");
    let app_data = base.join("appdata");
    let payload_dir = base.join("payload");
    std::fs::create_dir_all(&payload_dir).unwrap();

    let secret_file = payload_dir.join("infected.com");
    // Defender-independent payload: the vault test checks encryption
    // mechanics, not the EICAR signature path.
    let payload = SIM_EICAR.as_bytes();
    std::fs::write(&secret_file, payload).unwrap();

    let vault = Vault::new(&app_data);
    let outcome = vault.quarantine(&secret_file).expect("quarantine must succeed");

    // original gone
    assert!(!secret_file.exists(), "original must be removed after quarantine");
    // blob exists and is NOT plaintext (encrypted)
    let blob_path = app_data.join("vault").join(&outcome.vault_file);
    assert!(blob_path.exists());
    let blob = std::fs::read(&blob_path).unwrap();
    assert_ne!(blob, payload, "vault blob must be encrypted");
    assert!(
        !windows_contains(&blob, b"CS-EICAR-SIMULATION"),
        "plaintext payload marker must not be readable in vault blob"
    );

    // restore roundtrip
    let restore_to = payload_dir.join("restored.com");
    vault.restore(&outcome.vault_file, &restore_to).unwrap();
    let restored = std::fs::read(&restore_to).unwrap();
    assert_eq!(restored, payload, "restore must be byte-perfect");

    // destroy removes blob
    std::fs::write(&secret_file, payload).unwrap();
    let o2 = vault.quarantine(&secret_file).unwrap();
    vault.destroy(&o2.vault_file).unwrap();
    assert!(!app_data.join("vault").join(&o2.vault_file).exists());

    std::fs::remove_dir_all(&base).ok();
}

#[test]
fn entropy_function_bounds() {
    assert_eq!(entropy(b""), 0.0);
    assert_eq!(entropy(&[0u8; 100]), 0.0);
    let high = entropy(&(0..=255u8).collect::<Vec<u8>>());
    assert!((high - 8.0).abs() < 0.001, "uniform bytes = 8 bits/byte");
}

#[test]
fn detects_sim_ransomware_marker() {
    let dir = tmpdir("ransom");
    let file = dir.join("note.txt");
    std::fs::write(&file, "SIM-RANSOM-DEMO :: all documents locked :: send bitcoin for recovery key").unwrap();

    let engine = Engine::new();
    let report = engine.scan_file(&file, &hash_lookup);
    assert_eq!(report.verdict, "malicious", "ransom demo marker must be malicious");
    assert!(
        report.detections.iter().any(|d| d.name == "Sim_Ransomware_Demo"),
        "Sim_Ransomware_Demo rule must fire"
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn flags_ransom_note_indicators() {
    let dir = tmpdir("note");
    let file = dir.join("read_me.txt");
    std::fs::write(
        &file,
        "Your files have been encrypted. Send bitcoin to unlock them. Have a nice day.",
    )
    .unwrap();

    let engine = Engine::new();
    let report = engine.scan_file(&file, &hash_lookup);
    assert_eq!(report.verdict, "suspicious", "ransom-note wording must be suspicious");
    assert!(
        report.detections.iter().any(|d| d.name == "Ransomware_Note_Indicators"),
        "ransom-note rule must fire"
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn flags_usb_autorun_launcher() {
    let dir = tmpdir("autorun");
    let file = dir.join("autorun.inf");
    std::fs::write(&file, "[autorun]\nopen=update.exe\nicon=update.exe,0\n").unwrap();

    let engine = Engine::new();
    let report = engine.scan_file(&file, &hash_lookup);
    assert_eq!(report.verdict, "suspicious", "autorun launcher must be suspicious");
    assert!(
        report
            .detections
            .iter()
            .any(|d| d.name == "USB_AutoRun_Abuse" || d.name == "AutoRunLauncher"),
        "autorun YARA rule or heuristic must fire, got: {:?}",
        report.detections
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn flags_document_macro_lure() {
    let dir = tmpdir("macro");
    let file = dir.join("report.txt");
    std::fs::write(
        &file,
        "Sub Document_Open()\n  Set sh = CreateObject(\"WScript.Shell\")\n  sh.Run \"calc.exe\"\nEnd Sub",
    )
    .unwrap();

    let engine = Engine::new();
    let report = engine.scan_file(&file, &hash_lookup);
    assert_eq!(report.verdict, "suspicious", "macro lure must be suspicious");
    assert!(
        report
            .detections
            .iter()
            .any(|d| d.name == "Fake_Document_Macro_Lure"),
        "macro-lure rule must fire"
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn flags_encoded_payload_blob() {
    let dir = tmpdir("blob");
    let file = dir.join("decode.ps1");
    // deterministic ~1-of-each-position filler: valid base64 charset, 300 chars
    let blob: String = (0..300)
        .map(|i| {
            const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            CHARS[(i * 7 + i / 62) % 64] as char
        })
        .collect();
    std::fs::write(
        &file,
        format!("[System.Convert]::FromBase64String(\"{}\")", blob),
    )
    .unwrap();

    let engine = Engine::new();
    let report = engine.scan_file(&file, &hash_lookup);
    assert_eq!(report.verdict, "suspicious", "encoded blob must be suspicious");
    assert!(
        report
            .detections
            .iter()
            .any(|d| d.name == "Encoded_Payload_Blob"),
        "encoded-blob rule must fire"
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn flags_high_entropy_packed_sample() {
    let dir = tmpdir("packed");
    let file = dir.join("packed-demo.exe");
    // deterministic bytes with near-uniform distribution (~7.9 bits/byte)
    let data: Vec<u8> = (0..2048u32).map(|i| ((i * 7919) % 251) as u8).collect();
    std::fs::write(&file, &data).unwrap();

    let engine = Engine::new();
    let report = engine.scan_file(&file, &hash_lookup);
    assert_eq!(report.verdict, "suspicious", "packed sample must be suspicious");
    assert!(
        report
            .detections
            .iter()
            .any(|d| d.name == "HighEntropyExecutable"),
        "entropy heuristic must fire, got: {:?}",
        report.detections
    );
    std::fs::remove_dir_all(&dir).ok();
}

/// End-to-end proof: every demo-corpus file gets exactly the verdict the
/// README promises. This is the stage-demo safety net — if a rule change
/// breaks the story, this test fails before the event does.
#[test]
fn demo_corpus_end_to_end() {
    let corpus = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("manifest parent")
        .join("test-corpus");
    let engine = Engine::new();
    let reports = scan_directory(&engine, &corpus, &hash_lookup);

    let expect_malicious = &["eicar.com", "fake-trojan.txt", "fake-ransom.txt"];
    let expect_suspicious = &[
        "downloader.ps1",
        "suspicious.vbs",
        "autorun.inf",
        "invoice.pdf.exe",
        "packed-demo.exe",
        "macro-lure.txt",
    ];
    let expect_clean = &["README.md"];

    for name in expect_malicious {
        let r = reports.iter().find(|r| r.path.ends_with(name));
        assert!(r.is_some(), "{} must exist in the corpus", name);
        assert_eq!(r.unwrap().verdict, "malicious", "{} must be malicious", name);
    }
    for name in expect_suspicious {
        let r = reports.iter().find(|r| r.path.ends_with(name));
        assert!(r.is_some(), "{} must exist in the corpus", name);
        assert_eq!(r.unwrap().verdict, "suspicious", "{} must be suspicious", name);
    }
    for name in expect_clean {
        let r = reports.iter().find(|r| r.path.ends_with(name));
        assert!(r.is_some(), "{} must exist in the corpus", name);
        assert_eq!(r.unwrap().verdict, "clean", "{} must stay clean", name);
    }
}

fn windows_contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}
