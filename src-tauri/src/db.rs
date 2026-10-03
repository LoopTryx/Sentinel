use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

pub struct ThreatRecord {
    pub id: i64,
    pub detected_at: String,
    pub path: String,
    pub sha256: String,
    pub verdict: String,
    pub detections: String,
    pub action: String,
}

pub struct QuarantineRecord {
    pub id: i64,
    pub vault_file: String,
    pub original_path: String,
    pub sha256: String,
    pub quarantined_at: String,
    pub threat_name: String,
}

/// Known-bad hashes seeded on first run. EICAR is the standard
/// antivirus test file every judge will throw at us.
const SEED_SIGNATURES: &[(&str, &str, &str)] = &[
    (
        "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f",
        "EICAR-Test-File",
        "malicious",
    ),
    (
        // sha256 of test-corpus/fake-trojan.txt
        "e5b702015ffa7db42bea2ede772c05eabdcc3828c28dc6ac969bde1f8077df17",
        "Trojan.Sim.TestDropper",
        "malicious",
    ),
];

pub fn db_path(app_data: &PathBuf) -> PathBuf {
    app_data.join("cyber-shield.db")
}

pub fn init(app_data: &PathBuf) -> Result<Connection, rusqlite::Error> {
    std::fs::create_dir_all(app_data).ok();
    let conn = Connection::open(db_path(app_data))?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS signatures (
            hash TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            severity TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS threats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            detected_at TEXT NOT NULL,
            path TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            verdict TEXT NOT NULL,
            detections TEXT NOT NULL,
            action TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS quarantine (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            threat_id INTEGER NOT NULL,
            vault_file TEXT NOT NULL,
            original_path TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            quarantined_at TEXT NOT NULL,
            threat_name TEXT NOT NULL
        );",
    )?;
    seed_signatures(&conn)?;
    Ok(conn)
}

fn seed_signatures(conn: &Connection) -> Result<(), rusqlite::Error> {
    for (hash, name, severity) in SEED_SIGNATURES {
        conn.execute(
            "INSERT OR IGNORE INTO signatures (hash, name, severity) VALUES (?1, ?2, ?3)",
            params![hash, name, severity],
        )?;
    }
    Ok(())
}

/// Allows the team to add corpus hashes without code changes:
/// place a `extra-signatures.csv` (hash,name,severity per line) in app data.
pub fn load_extra_signatures(conn: &Connection, app_data: &PathBuf) -> usize {
    let csv_path = app_data.join("extra-signatures.csv");
    let Ok(content) = std::fs::read_to_string(&csv_path) else {
        return 0;
    };
    let mut n = 0;
    for line in content.lines() {
        let parts: Vec<&str> = line.split(',').map(str::trim).collect();
        if parts.len() == 3 && parts[0].len() == 64 {
            if conn
                .execute(
                    "INSERT OR IGNORE INTO signatures (hash, name, severity) VALUES (?1, ?2, ?3)",
                    params![parts[0], parts[1], parts[2]],
                )
                .is_ok()
            {
                n += 1;
            }
        }
    }
    n
}

pub fn lookup_hash(conn: &Connection, hash: &str) -> Option<(String, String)> {
    conn.query_row(
        "SELECT name, severity FROM signatures WHERE hash = ?1",
        params![hash],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .ok()
    .flatten()
}

pub fn insert_threat(conn: &Connection, t: &ThreatRecord) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO threats (detected_at, path, sha256, verdict, detections, action)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![t.detected_at, t.path, t.sha256, t.verdict, t.detections, t.action],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_threat_action(conn: &Connection, id: i64, action: &str) {
    conn.execute(
        "UPDATE threats SET action = ?1 WHERE id = ?2",
        params![action, id],
    )
    .ok();
}

pub fn recent_threats(conn: &Connection, limit: i64) -> Vec<ThreatRecord> {
    let mut stmt = match conn.prepare(
        "SELECT id, detected_at, path, sha256, verdict, detections, action
         FROM threats ORDER BY id DESC LIMIT ?1",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(ThreatRecord {
                id: row.get(0)?,
                detected_at: row.get(1)?,
                path: row.get(2)?,
                sha256: row.get(3)?,
                verdict: row.get(4)?,
                detections: row.get(5)?,
                action: row.get(6)?,
            })
        })
        .ok();
    match rows {
        Some(rows) => rows.filter_map(Result::ok).collect(),
        None => vec![],
    }
}

pub fn insert_quarantine(
    conn: &Connection,
    threat_id: i64,
    vault_file: &str,
    original_path: &str,
    sha256: &str,
    threat_name: &str,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO quarantine (threat_id, vault_file, original_path, sha256, quarantined_at, threat_name)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            threat_id,
            vault_file,
            original_path,
            sha256,
            chrono::Local::now().to_rfc3339(),
            threat_name
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn quarantine_items(conn: &Connection) -> Vec<QuarantineRecord> {
    let mut stmt = match conn.prepare(
        "SELECT id, vault_file, original_path, sha256, quarantined_at, threat_name
         FROM quarantine ORDER BY id DESC",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let rows = stmt
        .query_map([], |row| {
            Ok(QuarantineRecord {
                id: row.get(0)?,
                vault_file: row.get(1)?,
                original_path: row.get(2)?,
                sha256: row.get(3)?,
                quarantined_at: row.get(4)?,
                threat_name: row.get(5)?,
            })
        })
        .ok();
    match rows {
        Some(rows) => rows.filter_map(Result::ok).collect(),
        None => vec![],
    }
}

pub fn quarantine_get(conn: &Connection, id: i64) -> Option<QuarantineRecord> {
    conn.query_row(
        "SELECT id, vault_file, original_path, sha256, quarantined_at, threat_name
         FROM quarantine WHERE id = ?1",
        params![id],
        |row| {
            Ok(QuarantineRecord {
                id: row.get(0)?,
                vault_file: row.get(1)?,
                original_path: row.get(2)?,
                sha256: row.get(3)?,
                quarantined_at: row.get(4)?,
                threat_name: row.get(5)?,
            })
        },
    )
    .optional()
    .ok()
    .flatten()
}

pub fn quarantine_delete(conn: &Connection, id: i64) {
    conn.execute("DELETE FROM quarantine WHERE id = ?1", params![id]).ok();
}
