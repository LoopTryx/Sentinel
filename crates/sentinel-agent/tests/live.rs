#![cfg(windows)]
use sentinel_agent::jobs::JobStore;
use sentinel_proto::rpc::encode_frame;
use sentinel_svc::{live_pipe::connect_user, windows::OsIdentity};
use std::io::{Read, Write};
use std::os::windows::process::CommandExt;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

struct Agent {
    child: Child,
    journal: std::path::PathBuf,
    pipe: String,
    job: String,
    foreign_job: String,
}
impl Agent {
    fn start() -> Self {
        let suffix = format!(
            "{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let journal = std::env::temp_dir().join(format!("sentinel-live-{suffix}.jsonl"));
        let identity = OsIdentity::current_process().unwrap();
        let owner = format!("{}:{}", identity.sid, identity.session_id);
        let job;
        let foreign_job;
        {
            let store = JobStore::open(&journal).unwrap();
            job = store.create(&owner).unwrap().id;
            store.start(&job, &owner).unwrap();
            store.complete(&job, &owner).unwrap();
            foreign_job = store.create("other-user:other-session").unwrap().id;
            store
                .start(&foreign_job, "other-user:other-session")
                .unwrap();
            store
                .complete(&foreign_job, "other-user:other-session")
                .unwrap();
        }
        let pipe = format!(r"\\.\pipe\Sentinel-v1-user-{suffix}");
        let child = Command::new(env!("CARGO_BIN_EXE_sentinel-agent"))
            .args(["--live-lifecycle", "--pipe", &pipe, "--journal"])
            .arg(&journal)
            .creation_flags(0x08000000)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        Self {
            child,
            journal,
            pipe,
            job,
            foreign_job,
        }
    }
    fn request(&self, value: serde_json::Value) -> serde_json::Value {
        let deadline = Instant::now() + Duration::from_secs(3);
        let mut client = loop {
            match connect_user(&self.pipe) {
                Ok(client) => break client,
                Err(_) if Instant::now() < deadline => {
                    std::thread::sleep(Duration::from_millis(10))
                }
                Err(error) => panic!("live endpoint did not connect: {error}"),
            }
        };
        let (send, receive) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let result = (|| -> std::io::Result<serde_json::Value> {
                client.write_all(&encode_frame(&serde_json::to_vec(&value).unwrap()).unwrap())?;
                let mut header = [0; 4];
                client.read_exact(&mut header)?;
                let length = u32::from_be_bytes(header) as usize;
                assert!(length <= 1048576);
                let mut body = vec![0; length];
                client.read_exact(&mut body)?;
                Ok(serde_json::from_slice(&body).unwrap())
            })();
            let _ = send.send(result);
        });
        receive
            .recv_timeout(Duration::from_secs(3))
            .expect("live reply deadline")
            .unwrap()
    }
}
impl Drop for Agent {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = std::fs::remove_file(&self.journal);
    }
}

#[test]
fn live_process_returns_real_lifecycle_state_and_rejects_forged_identity() {
    let agent = Agent::start();
    let capabilities = agent
        .request(serde_json::json!({"version":{"major":1,"minor":0},"method":"capabilities.list"}));
    assert_eq!(capabilities["mode"], "live_lifecycle_only");
    assert_eq!(capabilities["scanAvailable"], false);
    let job = agent.request(
        serde_json::json!({"version":{"major":1,"minor":0},"method":"jobs.get","jobId":agent.job}),
    );
    assert_eq!(job["job"]["state"], "completed");
    let forged = agent.request(serde_json::json!({"version":{"major":1,"minor":0},"method":"jobs.get","jobId":agent.job,"ownerRef":"someone-else"}));
    assert_eq!(forged["error"], "bad_request");
    let privileged = agent
        .request(serde_json::json!({"version":{"major":1,"minor":0},"method":"usb.policy.apply"}));
    assert_eq!(privileged["error"], "unsupported_method");
    let unavailable =
        agent.request(serde_json::json!({"version":{"major":1,"minor":0},"method":"scan.start"}));
    assert_eq!(unavailable["error"], "unsupported_method");
    let foreign = agent.request(serde_json::json!({"version":{"major":1,"minor":0},"method":"jobs.get","jobId":agent.foreign_job}));
    assert_eq!(foreign["error"], "forbidden");
    let cancelled = agent.request(serde_json::json!({"version":{"major":1,"minor":0},"method":"jobs.cancel","jobId":agent.job}));
    assert_eq!(cancelled["error"], "invalid_transition");
    let mismatch = agent
        .request(serde_json::json!({"version":{"major":2,"minor":0},"method":"capabilities.list"}));
    assert_eq!(mismatch["error"], "unsupported_version");
}
