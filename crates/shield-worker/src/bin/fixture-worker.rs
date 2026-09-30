//! Test-only failure probe. Packaging must exclude this executable.
use std::io::Read;
use std::time::Duration;

fn main() {
    let mut first = [0u8; 1];
    let _ = std::io::stdin().read_exact(&mut first);
    match first[0] {
        b'H' => std::thread::sleep(Duration::from_secs(10)),
        b'F' => std::process::exit(7),
        _ => {}
    }
}
