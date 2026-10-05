# Durable job foundation implementation plan

**Goal:** Preserve owner-bound lifecycle states across agent restart with bounded, fail-closed storage.

**Architecture:** Extend the existing JobStore with an optional single-writer append journal. Serialize each committed state before changing memory. Replay only valid creation/transition sequences; recover running jobs as failed and queued jobs as cancelled, with those decisions persisted before returning the store.

**Tech stack:** Existing Rust/serde_json/std filesystem primitives; no dependency changes.

**Spec:** docs/Sentinel-Master-Plan.md sections 5.2–5.4 and 19; issue #6. This plan implements the persistence subtask only, not a replacement product plan.

**Constraints:** 1 MiB application messages; Windows user/session authorization remains mandatory for the live transport. No paths/file contents/secrets in lifecycle records. Bound the journal to 4 MiB, one record to 2 KiB, jobs to 4096, owner references to 256 UTF-8 bytes. Do not touch E: or alter system policy. No UI or generated contract changes in this increment.

## Task 1: Persistence and restart behavior

Files: crates/sentinel-agent/src/jobs.rs; new crates/sentinel-agent/src/job_journal.rs; tests/durable_jobs.rs.

Interface: `JobStore::open(path: impl AsRef<Path>) -> Result<JobStore, JobError>` alongside existing create/get/start/complete/fail/cancel. Add Corrupt/LimitReached storage errors. Existing in-memory API stays available.

- [x] Write failing tests: create/start/complete, drop/open, assert Completed; create another job and assert a distinct ID. Cross-owner reads/cancellation remain Forbidden after restart. Open running and queued jobs and assert Failed/Cancelled respectively.
- [x] Run `cargo test -p sentinel-agent --test durable_jobs` and observe missing persistence behavior.
- [x] Implement bounded exclusive-open journal, JSON-line strict schema and ordered state replay. Commit append+sync before changing the map; poison storage on I/O failure. Recovery writes explicit terminal records.
- [x] Run focused durable and existing job tests; inspect each failure.

## Task 2: Failure and concurrency boundaries

Files: same store/journal/tests; docs/evidence/durable-jobs.md.

- [x] Add tests for a second writer, malformed/torn/oversized files, duplicate IDs and illegal terminal transition records. Rejected opens must not truncate or rewrite corrupt evidence.
- [x] Race complete and cancel on a running job using a Barrier; require exactly one success and verify the persisted winner after restart.
- [x] Enforce bounds in both memory and replay. Under the mutex, clone the current job, validate its transition, persist it, then replace it; errors must not publish a successful state.
- [x] Run `cargo test -p sentinel-agent`, then `tools/verify.ps1` and `git diff --check`.
- [x] Record observed results/limits, commit, push and open an issue-linked PR for peer review. Continue to the live transport as a separate increment; persistence alone never means authenticated agent connectivity.
