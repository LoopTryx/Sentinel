use crate::jobs::{JobError, JobStore};
use sentinel_proto::rpc::{ProtocolVersion, RpcMethod};
use sentinel_svc::live_pipe::{AuthenticatedPipe, AuthenticatedRequest};
use serde::Deserialize;
use std::io;
use std::path::Path;
use std::time::{Duration, Instant};

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Request {
    version: ProtocolVersion,
    method: RpcMethod,
    job_id: Option<String>,
}

/// Explicit lifecycle-only live mode. No scan worker or privileged dispatch.
pub fn serve_lifecycle(name: &str, journal: &Path) -> io::Result<()> {
    let store = JobStore::open(journal).map_err(|_| io::Error::other("job storage unavailable"))?;
    let mut rate_window = Instant::now();
    let mut requests = 0;
    loop {
        let mut pipe = AuthenticatedPipe::bind(name)?;
        let connection_deadline = Instant::now() + Duration::from_secs(5);
        // One instance/connection, no queued tasks, at most eight exchanges
        // and five seconds per connection. Additional clients get pipe busy.
        for _ in 0..8 {
            let Some(remaining) = connection_deadline.checked_duration_since(Instant::now()) else {
                break;
            };
            if remaining.is_zero() {
                break;
            }
            let request = match pipe.receive(remaining) {
                Ok(request) => request,
                Err(_) => break,
            };
            if rate_window.elapsed() >= Duration::from_secs(1) {
                rate_window = Instant::now();
                requests = 0;
            }
            if requests >= 32 {
                let _ = pipe.reply(br#"{"error":"busy"}"#, Duration::from_millis(100));
                std::thread::sleep(Duration::from_secs(1).saturating_sub(rate_window.elapsed()));
                break;
            }
            requests += 1;
            let response = dispatch(&request, &store);
            if pipe.reply(&response, Duration::from_secs(1)).is_err() {
                break;
            }
        }
    }
}

fn dispatch(authenticated: &AuthenticatedRequest, store: &JobStore) -> Vec<u8> {
    let response = (|| -> Result<serde_json::Value, &'static str> {
        let request: Request =
            serde_json::from_slice(authenticated.payload()).map_err(|_| "bad_request")?;
        if request.version != ProtocolVersion::new(1, 0) {
            return Err("unsupported_version");
        }
        if request.method == RpcMethod::CapabilitiesList {
            if request.job_id.is_some() {
                return Err("bad_request");
            }
            return Ok(serde_json::json!({
                "mode":"live_lifecycle_only", "durableState":true, "scanAvailable":false,
                "availableMethods":["capabilities.list","jobs.get","jobs.cancel"]
            }));
        }
        if !matches!(request.method, RpcMethod::JobsGet | RpcMethod::JobsCancel) {
            return Err("unsupported_method");
        }
        let id = request.job_id.as_deref().ok_or("bad_request")?;
        if id.is_empty()
            || id.len() > 128
            || !id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        {
            return Err("bad_request");
        }
        let job = if request.method == RpcMethod::JobsGet {
            store.get(id, authenticated.owner_ref())
        } else {
            store.cancel(id, authenticated.owner_ref())
        }
        .map_err(|error| match error {
            JobError::Forbidden => "forbidden",
            JobError::NotFound => "not_found",
            JobError::InvalidTransition => "invalid_transition",
            JobError::LimitReached => "limit_reached",
            _ => "unavailable",
        })?;
        Ok(serde_json::json!({"mode":"live_lifecycle_only","job":job}))
    })();
    // The response consists only of bounded lifecycle metadata/static codes.
    // Parsing diagnostics and raw request content never leave the dispatcher.
    serde_json::to_vec(&response.unwrap_or_else(|error| serde_json::json!({"error":error})))
        .expect("bounded lifecycle response serializes")
}
