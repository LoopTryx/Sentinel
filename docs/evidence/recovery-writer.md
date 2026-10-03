# Issue #23: exclusive recovery journal ownership

Journal acquires an exclusive nonblocking OS file lock before reading, replaying, truncating a torn tail, or appending. The File retains that lock for the lifetime of Journal; dropping the journal releases it. Competing owners receive Busy, while other lock/I/O failures remain Io. No external dependency or stale lock-file cleanup is needed. Callers must release the current journal before an independent recovery process can take ownership.

The new regression failed before the fix because a competing same-process writer acquired the journal. After the fix, same-process contention reports Busy, an actual recovery child process fails while ownership is held, reopening after release succeeds, and both sequential acknowledged leases survive restart. Existing torn-tail, corrupt-record, restoration retry, and separate-process fixture recovery tests still pass. All seven recovery tests passed on Windows. This remains a fixture recovery library; no installed service or policy mutation is claimed.

Full tools/verify.ps1 passed on 2026-10-03, including workspace Rust checks/tests, TypeScript checks/tests, UI build, extension checks and generated contracts.
