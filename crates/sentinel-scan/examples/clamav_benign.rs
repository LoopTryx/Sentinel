//! Explicit local evaluator only. Not a product CLI/IPC/browser endpoint.
use std::{path::Path, time::Duration};
fn main() {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args.len() != 4 || args[0] != "--benign-selected-file" {
        eprintln!(
            "Usage: clamav_benign --benign-selected-file <sample> <verified-clamscan> <approved-db>"
        );
        std::process::exit(2);
    }
    let report = sentinel_scan::clamav::scan_benign_file(
        Path::new(&args[1]),
        Path::new(&args[2]),
        Path::new(&args[3]),
        Duration::from_secs(20),
        || false,
    );
    println!("{}", serde_json::to_string(&report).unwrap());
}
