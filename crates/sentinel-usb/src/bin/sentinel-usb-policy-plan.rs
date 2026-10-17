//! Bounded policy compiler only: no device, registry or filesystem mutation.
use sentinel_usb::policy::entries_from_record;
use std::io::{self, Read, Write};
fn run() -> Result<(), ()> {
    if std::env::args_os().len() != 1 {
        return Err(());
    }
    let mut record = Vec::new();
    io::stdin()
        .take(4073)
        .read_to_end(&mut record)
        .map_err(|_| ())?;
    if record.len() > 4072 {
        return Err(());
    }
    let entries = entries_from_record(&record).map_err(|_| ())?;
    let mut output = b"SNTPLAN1".to_vec();
    output.extend_from_slice(&(entries.len() as u16).to_le_bytes());
    for entry in entries {
        if entry.key.len() > 32 || entry.name.len() > 64 || entry.data.len() > 512 {
            return Err(());
        }
        output.push(entry.key.len() as u8);
        output.push(entry.name.len() as u8);
        output.extend_from_slice(&entry.kind.to_le_bytes());
        output.extend_from_slice(&(entry.data.len() as u16).to_le_bytes());
        output.extend_from_slice(entry.key.as_bytes());
        output.extend_from_slice(entry.name.as_bytes());
        output.extend_from_slice(&entry.data);
    }
    if output.len() > 32768 {
        return Err(());
    }
    io::stdout().write_all(&output).map_err(|_| ())
}
fn main() {
    if run().is_err() {
        eprintln!("policy_compile_refused");
        std::process::exit(2);
    }
}
