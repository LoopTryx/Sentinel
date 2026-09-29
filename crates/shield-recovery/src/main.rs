use shield_recovery::{Journal, JournalError, Lease};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() != 4 || args[0] != "--fixture-recover" {
        eprintln!(
            "Usage: shield-recovery --fixture-recover <journal> <fixture-dir> <unix-seconds>"
        );
        std::process::exit(2);
    }
    let now = match args[3].parse::<u64>() {
        Ok(now) => now,
        Err(_) => {
            eprintln!("Invalid time");
            std::process::exit(2);
        }
    };
    if !Path::new(&args[1]).is_file() || !Path::new(&args[2]).is_dir() {
        eprintln!("Fixture journal and directory must already exist");
        std::process::exit(2);
    }
    let mut journal = Journal::open(&args[1]).expect("fixture journal must be readable");
    let fixture_dir = Path::new(&args[2]);
    match journal.recover_expired(now, |lease| restore_fixture(fixture_dir, lease)) {
        Ok(count) => println!("Restored {count} expired fixture lease(s)"),
        Err(error) => {
            eprintln!("Fixture recovery failed: {error:?}");
            std::process::exit(1);
        }
    }
}

fn restore_fixture(directory: &Path, lease: &Lease) -> Result<(), JournalError> {
    let target = lease.target.as_str();
    if !target.starts_with("fixture-")
        || !target.ends_with(".txt")
        || !target
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        return Err(JournalError::RestoreFailed);
    }
    let path = directory.join(target);
    if !std::fs::symlink_metadata(&path)
        .map_err(|_| JournalError::Io)?
        .file_type()
        .is_file()
    {
        return Err(JournalError::RestoreFailed);
    }
    let mut file = OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(path)
        .map_err(|_| JournalError::Io)?;
    file.write_all(lease.prior_value.as_bytes())
        .map_err(|_| JournalError::Io)?;
    file.sync_all().map_err(|_| JournalError::Io)
}
