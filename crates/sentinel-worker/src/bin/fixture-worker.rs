//! Test-only failure probe. Packaging must exclude this executable.
use std::io::{Read, Write};
use std::time::Duration;

fn main() {
    let mut first = [0u8; 1];
    let _ = std::io::stdin().read_exact(&mut first);
    match first[0] {
        b'H' => std::thread::sleep(Duration::from_secs(10)),
        b'F' => std::process::exit(7),
        b'O' | b'E' => {
            let mut stdout = std::io::stdout().lock();
            stdout.write_all(&1_048_576u32.to_be_bytes()).unwrap();
            let chunk = [b' '; 8192];
            for _ in 0..129 {
                stdout.write_all(&chunk).unwrap();
            }
            stdout.flush().unwrap();
            if first[0] == b'E' {
                std::thread::sleep(Duration::from_secs(10));
            }
        }
        b'L' => {
            let payload = format!("{}{{}}", " ".repeat(128 * 1024));
            stdout_frame(payload.as_bytes());
        }
        b'B' => {
            std::io::stdout()
                .write_all(&1_048_577u32.to_be_bytes())
                .unwrap();
            std::io::stdout().flush().unwrap();
            std::thread::sleep(Duration::from_secs(10));
        }
        b'V' | b'T' | b'P' => {
            let report = sentinel_scan::pipeline::scan_stream(
                &mut first.as_slice(),
                sentinel_scan::pipeline::ScanLimits::default(),
                &mut || false,
            );
            let response = sentinel_worker::WorkerResponse {
                version: sentinel_worker::WORKER_PROTOCOL,
                report,
            };
            let mut payload = vec![b' '; 128 * 1024];
            payload.extend(serde_json::to_vec(&response).unwrap());
            stdout_frame(&payload);
            if first[0] == b'T' {
                stdout_frame(&payload);
            }
            if first[0] == b'P' {
                std::io::stdout().flush().unwrap();
                std::thread::sleep(Duration::from_secs(10));
            }
        }
        _ => {}
    }
}

fn stdout_frame(payload: &[u8]) {
    let mut stdout = std::io::stdout().lock();
    stdout
        .write_all(&(payload.len() as u32).to_be_bytes())
        .unwrap();
    stdout.write_all(payload).unwrap();
}
