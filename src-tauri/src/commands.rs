use crate::db::{self, Db};
use crate::engine::{self, Engine, ScanReport};
use crate::vault::Vault;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

pub struct AppState {
    pub engine: Engine,
    pub vault: Vault,
    pub app_data: PathBuf,
}

#[derive(Clone, Serialize)]
pub struct TelemetryEvent {
    pub kind: String,   // scan-started | file-scanned | threat-found | quarantined | scan-done | system
    pub level: String,  // info | warn | danger
    pub message: String,
    pub detail: Option<String>,
    pub ts: String,
}

pub fn emit(app: &AppHandle, kind: &str, level: &str, message: &str, detail: Option<String>) {
    let ev = TelemetryEvent {
        kind: kind.into(),
        level: level.into(),
        message: message.into(),
        detail,
        ts: chrono::Local::now().format("%H:%M:%S").to_string(),
    };
    app.emit("telemetry://event", &ev).ok();
}

#[derive(Serialize)]
pub struct ScanOutcome {
    pub reports: Vec<ScanReport>,
    pub malicious: usize,
    pub suspicious: usize,
    pub clean: usize,
    pub quarantined: usize,
}

#[tauri::command]
pub fn scan_path(path: String, app: AppHandle, state: State<AppState>, db: State<Db>) -> Result<ScanOutcome, String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("Path not found: {}", path));
    }

    emit(&app, "scan-started", "info", &format!("Scanning {}", path), None);

    let hash_lookup = |h: &str| db::lookup_hash(&db.0.lock().unwrap(), h);
    let reports: Vec<ScanReport> = if target.is_dir() {
        engine::scan_directory(&state.engine, &target, &hash_lookup)
    } else {
        vec![state.engine.scan_file(&target, &hash_lookup)]
    };

    let mut outcome = ScanOutcome {
        malicious: reports.iter().filter(|r| r.verdict == "malicious").count(),
        suspicious: reports.iter().filter(|r| r.verdict == "suspicious").count(),
        clean: reports.iter().filter(|r| r.verdict == "clean").count(),
        quarantined: 0,
        reports: Vec::new(),
    };

    for report in &reports {
        match report.verdict.as_str() {
            "malicious" => {
                emit(
                    &app,
                    "threat-found",
                    "danger",
                    &format!("THREAT: {}", Path::new(&report.path).file_name().unwrap_or_default().to_string_lossy()),
                    Some(
                        report
                            .detections
                            .iter()
                            .map(|d| format!("{}: {}", d.source, d.name))
                            .collect::<Vec<_>>()
                            .join(" | "),
                    ),
                );
                // Auto-quarantine malicious files — the "neutralize" step.
                match state.vault.quarantine(Path::new(&report.path)) {
                    Ok(res) => {
                        let detections_json = serde_json::to_string(&report.detections).unwrap_or_default();
                        let conn = db.0.lock().unwrap();
                        let threat = db::ThreatRecord {
                            id: 0,
                            detected_at: chrono::Local::now().to_rfc3339(),
                            path: report.path.clone(),
                            sha256: report.sha256.clone(),
                            verdict: report.verdict.clone(),
                            detections: detections_json,
                            action: "quarantined".into(),
                        };
                        let threat_id = db::insert_threat(&conn, &threat).unwrap_or(0);
                        let top_name = report
                            .detections
                            .first()
                            .map(|d| d.name.clone())
                            .unwrap_or_else(|| "Unknown".into());
                        if db::insert_quarantine(&conn, threat_id, &res.vault_file, &report.path, &report.sha256, &top_name).is_ok() {
                            drop(conn);
                            outcome.quarantined += 1;
                            emit(
                                &app,
                                "quarantined",
                                "danger",
                                &format!("Neutralized & encrypted in vault: {}", res.vault_file),
                                Some(report.path.clone()),
                            );
                        }
                    }
                    Err(e) => {
                        emit(&app, "threat-found", "warn", &format!("Quarantine failed: {}", e), Some(report.path.clone()));
                    }
                }
            }
            "suspicious" => {
                emit(
                    &app,
                    "threat-found",
                    "warn",
                    &format!("Suspicious: {}", Path::new(&report.path).file_name().unwrap_or_default().to_string_lossy()),
                    Some(
                        report
                            .detections
                            .iter()
                            .map(|d| format!("{}: {}", d.source, d.name))
                            .collect::<Vec<_>>()
                            .join(" | "),
                    ),
                );
                let detections_json = serde_json::to_string(&report.detections).unwrap_or_default();
                let conn = db.0.lock().unwrap();
                let threat = db::ThreatRecord {
                    id: 0,
                    detected_at: chrono::Local::now().to_rfc3339(),
                    path: report.path.clone(),
                    sha256: report.sha256.clone(),
                    verdict: report.verdict.clone(),
                    detections: detections_json,
                    action: "flagged".into(),
                };
                db::insert_threat(&conn, &threat).ok();
            }
            _ => {
                emit(&app, "file-scanned", "info", &format!("Clean: {}", Path::new(&report.path).file_name().unwrap_or_default().to_string_lossy()), None);
            }
        }
    }

    outcome.reports = reports
        .iter()
        .filter(|r| r.verdict != "clean")
        .cloned()
        .collect(); // UI shows only notable results for clean scans

    emit(
        &app,
        "scan-done",
        if outcome.malicious > 0 { "danger" } else if outcome.suspicious > 0 { "warn" } else { "info" },
        &format!(
            "Scan complete — {} clean, {} suspicious, {} malicious, {} quarantined",
            outcome.clean, outcome.suspicious, outcome.malicious, outcome.quarantined
        ),
        None,
    );
    Ok(outcome)
}

#[tauri::command]
pub fn simulate_attack(app: AppHandle, state: State<AppState>, db: State<Db>) -> Result<String, String> {
    // Writes an EICAR test file into a temp folder and immediately scans it.
    // Used by the demo "Attack Theater" and for rehearsal without a USB stick.
    // If Windows Defender blocks the real EICAR string from hitting disk
    // (OS error 225), we fall back to our Defender-independent CS_EICAR
    // simulation marker, which the YARA engine flags as malicious too.
    let dir = std::env::temp_dir().join(format!("cyber-shield-attack-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join("eicar_test.com");
    let real_eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    let sim_eicar = "CS-EICAR-SIMULATION :: Cyber Shield live demo payload :: detected by YARA rule CS_Sim_Eicar";

    let mut used_fallback = false;
    if let Err(e) = std::fs::write(&file, real_eicar) {
        if e.raw_os_error() == Some(225) || e.kind() == std::io::ErrorKind::PermissionDenied {
            used_fallback = true;
            std::fs::write(&file, sim_eicar).map_err(|e2| e2.to_string())?;
        } else {
            return Err(e.to_string());
        }
    }
    // Defender may also delete silently after the write — verify.
    if std::fs::read(&file).map(|b| b != real_eicar.as_bytes()).unwrap_or(true) {
        used_fallback = true;
        std::fs::write(&file, sim_eicar).map_err(|e2| e2.to_string())?;
    }

    emit(
        &app,
        "system",
        "warn",
        if used_fallback {
            "Simulated attack staged — Defender blocked raw EICAR, using CS simulation marker"
        } else {
            "Simulated attack staged — EICAR test file written"
        },
        Some(file.display().to_string()),
    );
    let res = scan_path(file.display().to_string(), app, state, db);
    std::fs::remove_dir_all(&dir).ok();
    res.map(|_| "EICAR attack simulated and neutralized".into())
}

#[derive(Serialize)]
pub struct ThreatRow {
    pub id: i64,
    pub detected_at: String,
    pub path: String,
    pub sha256: String,
    pub verdict: String,
    pub detections: String,
    pub action: String,
}

#[tauri::command]
pub fn list_recent_threats(db: State<Db>) -> Vec<ThreatRow> {
    let conn = db.0.lock().unwrap();
    db::recent_threats(&conn, 50)
        .into_iter()
        .map(|t| ThreatRow {
            id: t.id,
            detected_at: t.detected_at,
            path: t.path,
            sha256: t.sha256,
            verdict: t.verdict,
            detections: t.detections,
            action: t.action,
        })
        .collect()
}

#[derive(Serialize)]
pub struct QuarantineRow {
    pub id: i64,
    pub vault_file: String,
    pub original_path: String,
    pub sha256: String,
    pub quarantined_at: String,
    pub threat_name: String,
}

#[tauri::command]
pub fn list_quarantine(db: State<Db>) -> Vec<QuarantineRow> {
    let conn = db.0.lock().unwrap();
    db::quarantine_items(&conn)
        .into_iter()
        .map(|q| QuarantineRow {
            id: q.id,
            vault_file: q.vault_file,
            original_path: q.original_path,
            sha256: q.sha256,
            quarantined_at: q.quarantined_at,
            threat_name: q.threat_name,
        })
        .collect()
}

#[tauri::command]
pub fn restore_quarantine(id: i64, db: State<Db>, state: State<AppState>) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    let item = db::quarantine_get(&conn, id).ok_or("item not found")?;
    drop(conn);
    state
        .vault
        .restore(&item.vault_file, Path::new(&item.original_path))?;
    db::quarantine_delete(&db.0.lock().unwrap(), id);
    Ok(())
}

#[tauri::command]
pub fn destroy_quarantine(id: i64, db: State<Db>, state: State<AppState>) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    let item = db::quarantine_get(&conn, id).ok_or("item not found")?;
    drop(conn);
    state.vault.destroy(&item.vault_file)?;
    db::quarantine_delete(&db.0.lock().unwrap(), id);
    Ok(())
}

#[derive(Serialize)]
pub struct DriveInfo {
    pub letter: String,
    pub exists: bool,
}

#[tauri::command]
pub fn list_drives() -> Vec<DriveInfo> {
    let mut drives = Vec::new();
    for c in b'C'..=b'Z' {
        let letter = format!("{}:\\", c as char);
        let exists = std::fs::metadata(&letter).is_ok();
        drives.push(DriveInfo {
            letter: format!("{}:", c as char),
            exists,
        });
    }
    drives
}

#[derive(Serialize)]
pub struct AppStatus {
    pub threats_total: i64,
    pub quarantined_total: i64,
    pub signatures: i64,
    pub protection: String, // green | amber | red
}

#[tauri::command]
pub fn app_status(db: State<Db>) -> AppStatus {
    let conn = db.0.lock().unwrap();
    let threats_total: i64 = conn
        .query_row("SELECT COUNT(*) FROM threats", [], |r| r.get(0))
        .unwrap_or(0);
    let quarantined_total: i64 = conn
        .query_row("SELECT COUNT(*) FROM quarantine", [], |r| r.get(0))
        .unwrap_or(0);
    let signatures: i64 = conn
        .query_row("SELECT COUNT(*) FROM signatures", [], |r| r.get(0))
        .unwrap_or(0);
    let recent_red: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM threats WHERE verdict = 'malicious' AND detected_at > ?1",
            (params_local(10),),
            |r| r.get(0),
        )
        .unwrap_or(0);
    let recent_amber: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM threats WHERE verdict = 'suspicious' AND detected_at > ?1",
            (params_local(10),),
            |r| r.get(0),
        )
        .unwrap_or(0);
    let protection = if recent_red > 0 {
        "red"
    } else if recent_amber > 0 {
        "amber"
    } else {
        "green"
    };
    AppStatus {
        threats_total,
        quarantined_total,
        signatures,
        protection: protection.into(),
    }
}

// chrono Local::now minus N minutes, as RFC3339, for the recency window
fn params_local(minutes_ago: i64) -> String {
    (chrono::Local::now() - chrono::Duration::minutes(minutes_ago)).to_rfc3339()
}
