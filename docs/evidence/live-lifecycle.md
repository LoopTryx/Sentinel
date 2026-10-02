# Live lifecycle transport — #6 / PR #19

2 October 2026. The agent now has an explicit Windows `--live-lifecycle --pipe <name> --journal <selected-file>` mode, separate from fixture stdio. Pipe names use the local `\\.\pipe\Sentinel-v1-user-` prefix and a bounded digits/hyphens suffix. This is a manually launched lifecycle endpoint, not an installed protection service or live scanner.

The server creates one non-inheritable first-instance pipe, rejects remote clients, and grants client data/synchronize rights to the actual logon SID. After reading each bounded request it impersonates the pipe client, reads the real Windows SID/session, checks both against the server's session, reverts impersonation, and constructs the private authenticated request. Payload identity fields cannot manufacture that request.

Connect/read/write use overlapped operations with deadlines. Declared internal big-endian payload length is checked before allocation, with a 1 MiB application cap. Timed-out operations are cancelled and their completion is observed before releasing borrowed buffers/OVERLAPPED storage. If Windows cannot finish cancellation within a further one second, the process aborts rather than risking a kernel write through expired stack storage. That fail-closed path is not experimentally forced; normal idle/read/write deadline paths are tested.

One connection/request in flight, no task queue, at most eight exchanges and five seconds per connection; at most 32 requests per one-second rate window. A reply attempt consumes its authenticated request permit. Dispatch permits only capabilities.list, jobs.get and jobs.cancel. Request schema rejects ownerRef and unknown fields; exact protocol 1.0 is required. Job access uses the actual SID/session owner. Capabilities explicitly say live_lifecycle_only and scanAvailable:false; scan.start and privileged methods are rejected. Responses contain bounded lifecycle metadata/static error codes, never raw parsing diagnostics or request bodies.

## Actual evidence

Three initial actual-pipe tests failed against the unsupported transport stub. Four now pass: actual client-token identity plus framing/second-server/duplicate-reply checks, idle and partial-read deadlines, oversized header without a body, and a stalled reader causing a bounded write timeout. The initial agent-process test failed to connect to the unsupported mode stub; it now passes capabilities, persisted completed-job retrieval, forged owner rejection, foreign-owner denial, immutable terminal cancellation, version rejection and scan/privileged-method denial against an actual hidden agent process. Test processes are killed/reaped and harmless temporary journals removed.

All sentinel-agent tests (13 integration tests), sentinel-svc tests (11 unit plus four live-pipe tests), and tools/verify.ps1 pass. Native window smoke passes. Existing code/fixtures remain separate. The agent adds only the existing workspace sentinel-svc dependency; Cargo.lock records that edge, with no third-party package change.

Reproduce: `cargo test -p sentinel-svc --test live_pipe`, `cargo test -p sentinel-agent --test live`, then `tools/verify.ps1`. A manually selected empty journal file and local pipe name can be used with the mode above; no agent is left running by tests.

## Remaining acceptance

No actual scan-start/progress/report dispatch, isolated owned worker, durable report payload, installed agent lifecycle, storage-directory ACL/ancestor hardening, compaction or UI adapter yet. Actual remote/cross-user/session Windows account tests require the corresponding controlled accounts/sessions; policy unit tests are not represented as live account tests. Pending UI and native-host integration cannot claim live scanning from this lifecycle endpoint. No E: access, malware files, USB/HID blocking or Defender changes.

Follow-up: connect_user now queries the actual named-pipe server PID and its Windows token before sending application bytes, requiring the caller's current SID/session. A real connected server-token test was observed failing against an accept-all stub, then passed for matching identity and rejection of mismatched expected SID/session. This is per-user/session identity, not binary signing or protection against a compromised same-user process. All live agent exchanges continue to pass with server verification enabled.
