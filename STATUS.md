# Implementation status

Updated: 2026-09-29

| Task | State | Evidence |
| --- | --- | --- |
| T00 Capability and threat-model dossier | In progress; policy/HID probes deferred | Read-only inventory confirmed an owned removable FAT32 `CRYPTIC` (E:) volume. No disposable Windows 11 machine or HID test device is available |
| T01 Contracts, jobs, functional shell | In progress | Rust contracts, generated TS bindings, shared CLI/UI fixture, CI, safe defaults, owner-bound in-memory jobs, and bounded RPC framing pass available checks. A fixture-only agent process answers one framed standard-input request. Authenticated live IPC remains open |
| T02 Privilege boundary and recovery | In progress | A file-backed lease journal and separate fixture recovery executable pass recovery tests. A fixture-only Windows named pipe verifies the client's token SID/session after reading, rejects remote clients, and passes DACL, method, and frame tests. No installed service, admin pipe, actual policy mutation, or scheduled recovery trigger exists yet |
| T03 Intel cache and provider controls | In progress | URLhaus-format fixture parser, offline exact-match cache, and local import/lookup CLI validate bounds, provenance, expiry, duplicates, corruption, and interrupted activation. Authenticated downloads, provider consent UI, signature policy, and performance gate remain open |
| T04–T17 | Not started | No product implementation or verification evidence yet |

## Next T00 work

1. Confirm OS edition/build and Defender state with an authorized host inventory; the current shell denied CIM and Defender status queries.
2. Complete read-only host and dependency probes that do not change system policy.
3. Use `CRYPTIC` only for non-destructive storage observations and harmless scanner fixtures. When a disposable Windows 11 setup and owned HID device become available, run policy, pre-access storage, HID, recovery, and isolation probes there.
4. Record actual results, fallback decisions, dependency licenses, and a working pinned toolchain before closing T00.

No USB enforcement experiment should run on the daily-use machine during discovery.
Software contracts, fixtures, and UI states may proceed while hardware evidence is pending. The USB Gate remains disabled and R1 cannot be declared complete until its physical acceptance matrix passes.

## T02 checkpoint

`shield-recovery` records a lease and its prior value before a future mutation, syncs each journal event, and replays expired entries after restart. A restore callback must be idempotent because a crash can occur after restoration but before the completion event is durable. A separate executable restores a fixture file with the agent closed; it rejects target names outside the fixture directory. This has no OS policy adapter, access-control hardening, or scheduled recovery trigger, so it does not satisfy the T02 gate.
`shield-svc` now has a deny-by-default policy for a fixed RPC method enum. A fixture-only named pipe uses an explicit logon-session SID DACL and `PIPE_REJECT_REMOTE_CLIENTS`, then impersonates the client after reading the frame and obtains SID/session/elevation from the thread token. Local tests passed for valid fixture capabilities, forged identity fields, admin-method denial, oversized frames, and denial of a second same-user server instance. This is not an installed service; it has no admin endpoint, read timeout, rate limiter, or policy adapter. See [IPC evidence](docs/evidence/ipc-boundary.md).

## T03 checkpoint

The `shield-intel` crate parses a URLhaus-format fixture with strict URL and size limits, then activates a disk snapshot only after validation. On offline startup it selects a valid snapshot and reports `listed`, `not listed`, `stale`, or `unavailable` without calling an unlisted URL safe. A digest detects accidental cache corruption; it is not a provider signature. Provider network access remains disabled by default and no API key is stored. See [provider registry](docs/evidence/provider-registry.md).

## T01 checkpoint

Rust 1.98.1 GNU toolchain and MinGW 16.2.0 were installed because the MSVC linker was absent. The first contract and CLI/UI tests were observed failing before implementation and then passing after implementation. The shared fixture is explicitly labeled as a preview. No service, scan, or USB enforcement exists yet.
The `shield-core` default disables provider requests and USB policy changes. `shield-agent` now enforces job ownership and terminal-state transitions in memory; no privileged pipe or persisted job exists yet.
The agent's `--fixture-stdio` mode accepts only a versioned `status_fixture` request and returns the same typed status fixture used by the CLI and UI. Process-level tests cover its exact output, protocol mismatch, malformed/truncated requests, and the 1 MiB limit. It is a development endpoint, not a protection service.
The first Windows CI runs passed tests and build but the generated-binding check falsely flagged rewritten files because it used `git status`; a fresh CRLF checkout reproduced status changes with no content diff. The verifier now checks actual diffs and untracked outputs. Windows CI run 4 completed successfully on commit `b7010e9`.
