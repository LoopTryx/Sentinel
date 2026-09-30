use sentinel_proto::rpc::encode_frame;
use sentinel_scan::pipeline::{ScanLimits, scan_stream};
use sentinel_worker::{WORKER_PROTOCOL, WorkerResponse};
use std::io::{self, Write};

fn main() {
    if std::env::args().skip(1).collect::<Vec<_>>() != ["--scan-stdin"] {
        eprintln!("Usage: sentinel-worker --scan-stdin");
        std::process::exit(2);
    }
    let report = scan_stream(&mut io::stdin().lock(), ScanLimits::default(), &mut || {
        false
    });
    let response = WorkerResponse {
        version: WORKER_PROTOCOL,
        report,
    };
    let payload = serde_json::to_vec(&response).expect("bounded scan response is serializable");
    let frame = encode_frame(&payload).expect("bounded scan response fits protocol frame");
    if io::stdout().lock().write_all(&frame).is_err() {
        std::process::exit(1);
    }
}
