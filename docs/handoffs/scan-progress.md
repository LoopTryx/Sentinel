# Selected-directory progress: S1 integration handoff

Issue #9; Codex scanner/contracts, GLM views (#11), coordinator reviewed integration. This leaf emits actual progress from the existing benign read-only folder scanner. It does not implement a native command, durable job, process timeout or GUI.

## Functions and DTO

```rust
sentinel_scan::pipeline::scan_directory_with_progress(
    root: impl AsRef<Path>,
    file_limits: ScanLimits,
    directory_limits: DirectoryLimits,
    cancelled: impl FnMut() -> bool,
    progress: impl FnMut(&DirectoryScanProgress),
) -> DirectoryReport
```

Source DTO: sentinel_proto::scan_progress::{DirectoryScanProgress, DirectoryScanStage}; generated TS files of the same names under packages/contracts/src/generated. `scan_directory` retains its original signature and report; it delegates with a no-op observer. Both entry points now check cancellation before filesystem access, including an empty root.

The cancellation predicate and observer execute synchronously on the caller's scanning thread. Run on a background worker, never the UI dispatcher. Observer must be fast/nonblocking and must not panic; marshal a copy to a bounded latest-snapshot slot rather than queue every callback. The scanner stores one previous snapshot and suppresses identical callbacks. It emits initial zero counters, changed traversal counters, and exactly one `finished` snapshot on normal return. A panic, process kill or blocked filesystem call is outside that return guarantee.

Snapshots arrive at entry boundaries and after a file result, not each 8192-byte read. During one large file the UI may display elapsed/indeterminate activity, but must not fabricate byte updates. Cancellation is checked before traversal and between entries/read chunks; it cannot interrupt a blocking OS read. Parent timeout/worker termination and job ownership remain separate integration responsibilities.

## Wire example

This is callback JSON, not an accepted RPC request:

```json
{"stage":"finished","entriesVisited":"2","filesVisited":"2","filesChecked":"2","filesSkipped":"0","accessErrors":"0","engineFailures":"0","bytesRead":"6","traversalComplete":true,"cancelled":false,"limitReached":false}
```

It is produced by a selected folder containing two invented three-byte files. Rust counters are u64; JSON and generated TS use canonical unsigned decimal **strings** to avoid bigint/JSON precision mismatch. Parse to BigInt only for calculation, display as text; do not convert arbitrarily large counters to Number. Decoder rejects numeric JSON, signs, leading zeros and overflow. Deserialize only within the existing bounded transport envelope; this DTO parser is not a standalone hostile-input size gate.

A future local wrapper request might carry `{selectionRef, jobId}` referring to an authorized native picker selection. This leaf accepts an already approved Rust path, not arbitrary browser paths; no such wrapper is registered. Bind callback copies to the authenticated/local job and selected subject in the adapter. The DTO deliberately excludes paths, names, content, user identity and hashes. No GUI should associate an old reply with a newly selected folder.

## Meaning and failure states

- `running`: traversal has not returned; totals/percent are unknown. Counters are cumulative observations, not the count of all files on disk.
- `finished`: traversal returned. It is not JobState::Completed, protection, or full detection coverage. Inspect flags/counters and actual report before choosing presentation.
- `cancelled=true` or `limitReached=true`: incomplete. `traversalComplete=false` also covers skips, access errors and engine failures. Missing root returns accessErrors="1"; unsupported root returns a skip. These never count as checked.
- `filesVisited` counts regular-file scan attempts. `filesSkipped` may include directories, symlinks or unsupported entries, and `accessErrors` may include directory/metadata reads. Do not assume checked+skipped+errors equals filesVisited. `bytesRead` may include incomplete/cancelled file bytes; checked counts only completed checks.
- `traversalComplete=true` means only implemented traversal finished without those gaps. Engine coverage stays **partial**, full signature engine inactive; do not render a green protection shield. Existing byte-cap, entry/depth/pending/finding bounds and discovered-link exclusions still apply. Ancestor replacement, hostile parser isolation and broad threat detection remain unsupported.
- No timeout flag is synthesized by the library. Adapter must represent an actual deadline/termination separately and retain last known counters with incomplete coverage. No callback/report after termination is guaranteed.
- No profile or native capability becomes available from this DTO. #19 remains scanAvailable=false until real dispatch is implemented and verified. Keep unsupported actions disabled.

## Acceptance and next action

`cargo test -p sentinel-scan --test progress --test pipeline` verifies actual benign counts, intermediate updates, final parity, callback-triggered cancellation after one file, limits/skips, missing root and initial empty-directory cancellation. `cargo test -p sentinel-proto` checks regeneration and exact/full-width decimal round-trip/rejection. Run full tools/verify.ps1 after committing generated outputs.

Coordinator: serialize new proto export with other pending PRs, then peer-review/integrate. Codex next: attach these counters to the reviewed scan job/local adapter, retaining actual timeout/report semantics; single-file/chunk-level UI updates remain separate work. GLM: review decimal counters and state semantics, then consume on your branch after adapter availability. UI keyboard/cancel/repeated-selection/error journeys and event rehearsals remain pending. No E:, policy changes, live malware or EICAR files used.
## Single-file cooperative cancellation follow-up

Public Rust API: `sentinel_scan::pipeline::scan_file_with_cancel(path: impl AsRef<Path>, limits: ScanLimits, cancelled: &mut impl FnMut() -> bool) -> ScanResult`. This exposes the existing selected-file path with cancellation checked before metadata/open and between read chunks. `scan_file` keeps its original signature and delegates with false. The adapter must authorize selection and call from a worker thread; an AtomicBool-backed predicate can carry UI cancellation. Cancellation is sticky in the adapter; no reset while a request is active.

For initial cancel the report is state=cancelled, bytesRead=0, filesChecked=0, filesSkipped=1, accessErrors=0, sha256=null. A non-cancelled invalid/missing path remains access_error. The file result's filesVisited=1 represents the requested scan attempt, not proof that metadata or bytes were read. Cancellation after one read chunk retains bytesRead=8192 but no hash/checked count; interrupted bytes are not inspected coverage. The actual test's uncancelled positive control reads all 20000 benign bytes and returns one checked result.

No native/Tauri/CLI cancel endpoint, single-file progress callback, timeout state, protected service or full signature coverage is enabled here. ScanResult is the existing Rust/JSON report, not the generated DirectoryScanProgress DTO; the local adapter still needs authoritative typed result conversion/review, subject/job correlation, transport bounds and actual timeout semantics before GLM can call it. Do not use a raw browser path or shell command built from user input. Mid-read cancellation cannot interrupt a blocked filesystem read, so parent deadline/termination remains required. Tests: initial invalid-path cancellation was observed failing with AccessError; after correction it passes alongside a real benign mid-read/retry positive control. All five directory-progress tests remain passing.
