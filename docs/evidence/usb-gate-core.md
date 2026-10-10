# USB gate/recovery implementation candidate

Engineer B, issue12 accepted handoff6099690602; claim6100413399. Branch `codex/engineer-b/issue-12-usb-gate`, base `a9495cfdadf6cc50af7d773b5643c83caf21e167`. Reviewer Engineer A; coordinator integrates.

New standalone std-only Rust crate implements bounded connection/job lifecycle, separate storage/HID decisions, explicit single-use release proposals, pre-action revalidation and fail-closed report invalidation. Recovery protocol persists a bounded versioned lease before any backend mutation and requires verified scoped restoration before journal clear. No root/shared/native/AV/UI files changed.

Regressions cover composite independence, missing holds/interfaces, partial/failed/finding reports, disconnect/reconnect, service-run mismatch, replaced jobs, stale reports, rollback, authorization refusal, full capacity, failed/delayed/superseded release callbacks, persistence-before-apply, failed persistence/verification/clear, unrelated drift, restart and malformed/excessive leases. Recovery tests use an in-memory store and simulated backend; they do not prove Windows durability, ACL enforcement, independent watchdog execution or physical device containment.

Tests first failed because the core did not exist. A new recovery regression then reproduced an unexpired journal incorrectly becoming Applied; implementation now reports Armed. Review found and corrected stale action completion preserving a newer hold claim; dedicated regression requires Gap. The PR records final explicit standalone fmt/clippy/tests and complete unchanged root-verifier results. Root checks alone exclude this isolated crate.

Remaining: substantive peer authority/recovery review; agreed shared root/native wiring; production Windows scoped policy backend and crash-durable private journal; independent watchdog; authoritative selected-folder scanner integration; authenticated IPC; physical recoverable-lab hardware matrix and release/CI gates. No protection is enabled or ready to ship by this candidate. No daily-machine policy/driver/HID mutation, Defender change, USB folder read or E: access.

Executed final checks: standalone cargo fmt --check, strict clippy --all-targets -D warnings and19 regressions PASS; unchanged root tools/verify.ps1 exit0 / All available T01 checks passed on pinned GNU Rust1.98.1. Existing root UI/extension/runtime tests and generated parity passed. These checks do not include a native USB adapter or physical enforcement. No live OS policy mutation was executed.

## Workspace verification registration (10 October 2026)

Accepted shared-file handoff: issue12 comment6100535864; execution claim6100874585. The root workspace now includes sentinel-usb. The redundant nested workspace and lockfile are removed. Root Cargo.lock adds only sentinel-usb0.1.0, with no dependencies or version changes. Existing tools/verify.ps1 and Windows CI already use workspace-wide formatting, strict lint and tests, so neither verifier nor CI needs modification. The earlier standalone/excluded statements above describe the previous candidate only.

Focused workspace cargo test -p sentinel-usb passes all19 regressions. Windows policy installation, measured pre-input denial, production private recovery journal/watchdog, authenticated native commands and physical acceptance remain absent. This change improves required verification coverage; it does not enable USB protection.
Complete unchanged tools/verify.ps1 also PASS (exit0), including USB workspace regressions, Rust lint/format, generated contract parity, UI/extension/runtime checks. Log: D:\SENTINAL\usb-workspace-registration-verify.log. No live policy changes performed. Independent review remains pending; earlier remote CI runs failed and are not counted as passing.
