//! Test-only failure probe. Packaging must exclude this executable.
use std::io::{Read, Write};
use std::time::Duration;

fn main() {
    if std::env::args().any(|arg| arg == "--child") {
        std::thread::sleep(Duration::from_secs(10));
        return;
    }
    let mut first = [0u8; 1];
    let _ = std::io::stdin().read_exact(&mut first);
    match first[0] {
        #[cfg(windows)]
        b'A' => {
            use windows_sys::Win32::Foundation::HANDLE;
            use windows_sys::Win32::System::Threading::SetEvent;
            let mut bytes = [0u8; 8];
            std::io::stdin().read_exact(&mut bytes).unwrap();
            let handle = u64::from_le_bytes(bytes) as usize as HANDLE;
            // SAFETY: SetEvent validates this test-only candidate handle. The
            // parent observes its own event, avoiding false numeric-handle collisions.
            unsafe {
                SetEvent(handle);
            }
        }
        #[cfg(windows)]
        b'J' | b'M' => {
            use std::os::windows::process::CommandExt;
            if first[0] == b'J' {
                if let Ok(mut child) = std::process::Command::new(std::env::current_exe().unwrap())
                    .arg("--child")
                    .creation_flags(0x08000000)
                    .spawn()
                {
                    let _ = child.kill();
                    let _ = child.wait();
                    std::process::exit(7);
                }
            } else {
                let mut allocation = Vec::<u8>::new();
                if allocation.try_reserve_exact(512 * 1024 * 1024).is_ok() {
                    std::process::exit(7);
                }
            }
            let report = sentinel_scan::pipeline::scan_stream(
                &mut first.as_slice(),
                sentinel_scan::pipeline::ScanLimits::default(),
                &mut || false,
            );
            stdout_frame(
                &serde_json::to_vec(&sentinel_worker::WorkerResponse {
                    version: sentinel_worker::WORKER_PROTOCOL,
                    report,
                })
                .unwrap(),
            );
        }
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
