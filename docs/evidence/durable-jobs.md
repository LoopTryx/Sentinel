# Durable lifecycle store — issue #6

2 October 2026. The optional `JobStore::open(path)` stores only job ID, owner reference and lifecycle state in a versioned JSON-line journal. The existing in-memory API remains available. No selected path, file contents, password or report payload is recorded.

One mutex serializes memory and journal changes. Each transition is checked on a clone, appended and synced before the new state is returned. I/O failure poisons the store so subsequent operations return unavailable. A single-writer file lock and Windows exclusive sharing prevent a second writer. IDs are replayed in creation order and not reused. Replay rejects unknown fields/version, invalid ownership changes, duplicate creations and illegal state transitions. Torn or corrupt evidence is preserved, not truncated into a seemingly valid store.

Bounds: 4 MiB journal, 2 KiB record, 4096 jobs and 256 UTF-8 bytes per owner reference. The Windows final component is opened without following reparse points and rejected if its attributes indicate one. Parent-directory ACLs/reparse protection, journal authentication, compaction/retention and secure default storage selection remain separate gates. This is not tamper-proof storage; an attacker with write authority can replace a structurally valid history.

On open, running jobs become failed and queued jobs become cancelled, with explicit terminal records persisted. No worker is resumed or completed from stale metadata. Capacity exhaustion returns a limit error; a store without enough capacity for recovery does not open as healthy. Admission now reserves two maximum-size future records per queued job (start plus terminal) and one per running job. Every mutation preserves remaining reservations, so new work cannot consume the space needed for cancellation/failure/recovery. Compaction remains required for ongoing operation after terminal history fills the journal.

## Actual validation

The initial restart tests compiled against a minimal open stub and failed with NotFound after restart. After persistence implementation, `cargo test -p sentinel-agent` passes all 12 integration tests: six durable tests plus existing ownership/lifecycle and fixture-stdio tests. Durable tests cover terminal states/IDs/ownership across restart, explicit interrupted recovery, actual exclusive writer denial, eleven corrupt/torn-history cases with byte-for-byte evidence preservation, byte/job/owner bounds, and a real concurrent complete/cancel race whose winner is verified after reopen.

`tools/verify.ps1` passes Rust formatting/lint/workspace tests, generated bindings, TypeScript tests/typecheck, UI build and 32 extension tests plus build/parity smoke. Native sources are unchanged. No E: access, policy changes or malware files.

Reproduce: `cargo test -p sentinel-agent --test durable_jobs`, then `tools/verify.ps1` on the repository Windows toolchain.

Follow-up: the saturated-journal regression first failed with LimitReached on cancellation. With reservations, all seven durable tests pass; the regression saturates admission using benign escaped owner metadata, cancels a running job and recovers all queued jobs after restart within the 4 MiB cap. Full tools/verify.ps1 passes on the combined mutual-identity/reservation tree.

## Remaining #6 acceptance

The library foundation alone is not authenticated live connectivity. A follow-up on this branch supplies a real lifecycle-only Windows endpoint with actual pipe-client SID/session, bounded overlapped transport and narrow method dispatch; see [live lifecycle evidence](live-lifecycle.md). Durable reports/progress, actual scan workers and cancellation, installed lifecycle and storage-directory protection remain open. Live scanning is explicitly unavailable.
