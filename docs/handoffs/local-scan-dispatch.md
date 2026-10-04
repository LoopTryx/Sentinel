# Native benign scan dispatcher — issue 9

`sentinel_scan::dispatch::NativeScanDispatcher` is an internal native Rust API, not a Tauri command, remote decoder, installed service or hostile-file sandbox. It runs the existing static benign-sample scanner on one background thread. Integrate only after independent review of PR36/42 and this leaf. No presentation files or dependencies changed.

## Entry points

- `new()` creates one dispatcher with no session.
- `start(&mut self, registry: &NativeSelectionRegistry, selection_ref: &str, timeout: Duration) -> Result<ScanTicket, DispatchError>` resolves only the current trusted native-picker registration. It copies that approved path privately, captures File/Directory kind, allocates a fresh process-local job reference and starts a thread. Timeout uses existing 1ms–300s cooperative monotonic control; starts before spawn. No raw path is accepted by the dispatcher API.
- `ScanTicket { job_id, selection_ref }` is correlation only, never bearer authorization. Every poll/cancel/abandon/clear must use BOTH exact active references.
- `poll(&mut self, &ScanTicket) -> Result<DispatchSnapshot, DispatchError>` is nonblocking. Snapshot contains existing `LocalScanControlState`, `worker_returned`, `abandoned`, optional generated `BoundDirectoryProgress` and optional native `NativeScanReport::{File(SelectedFileReport), Directory(SelectedDirectoryReport)}`. This wrapper is native-only, not a new serialized protocol or hand-written TS DTO. Future command wiring must define/regenerate its authoritative wire envelope before GLM consumes it.
- `cancel(&self, &ScanTicket) -> bool` requests sticky cancellation only for the exact current operation. False means no match, not cancelled success.
- `abandon(&mut self, &ScanTicket) -> bool` requests cancellation and permanently suppresses old progress/report output; still retain and poll the session to reap. Call BEFORE replacing/clearing picker selection, navigating away or accepting a new scan. Registry replacement alone does not invalidate a live dispatch.
- `clear_returned(&mut self, &ScanTicket) -> bool` succeeds only after poll has joined the matching finished worker. It drops retained result/session. No job reuse or implicit rescan.

## Bounds and lifecycle

### Selection-aware adapter polling

`poll_current(&mut self, registry: &NativeSelectionRegistry, ticket: &ScanTicket) -> Result<DispatchSnapshot, DispatchError>` is the preferred native adapter observation. If the ticket's selection no longer resolves in the trusted registry, it calls `abandon` BEFORE polling/joining. This covers selection clear, replacement, and rejected registration (which clears the registry). Old progress and reports remain permanently suppressed, including already returned reports. Unknown tickets still return `WrongOperation` and cannot abandon another session.

Example: `let snapshot = dispatcher.poll_current(&registry, &ticket)?;`. A valid current selection preserves ordinary progress/report output. On invalidation, `abandoned=true`; `worker_returned=false` may persist until the actual cooperative worker exits. Continue polling and clear only after actual join. Errors retain the existing fixed path-free variants, including persistent `WorkerFailed`. No new wire DTO, endpoint or capability is added. The native host must serialize picker registration and polling; UI must still invalidate its own previously rendered state on selection/view changes. Low-level `poll` remains available for reap/cleanup and does not itself consult the registry. This guard cannot revoke output already shown, establish handle identity, or interrupt blocked OS I/O.

Fixed S1 limits: 8 MiB per file, 128 traversal entries, depth 4, 128 pending directories and 64 scanner findings; existing report conversion remains path-free/partial with explicit omissions. These bounds are scope, not a success guarantee. Display skips/limits and actual engine capability. Directory updates use one latest slot; file reads do not invent per-chunk progress. The thread retains one result via its JoinHandle, not an event queue. Poll clones at most that bounded typed report; consumer polling/history must also be bounded.

One process-global RAII permit admits this API's active scan. Worker AND owning session retain it, so a stopped/finished-but-unreaped session remains busy until poll joins it. A dispatcher retains at most one session, even after completion; clear explicitly before reuse. Do not create unbounded dispatchers/history. This gate does not restrict direct library scanners or other processes; the future command host must own one dispatcher and serialize native calls.

Poll joins only after JoinHandle::is_finished. `worker_returned=true` means that actual thread has been joined, including its cleanup; it does not mean clean evidence, complete engine coverage or service durability. Completed scanner outcomes preserve access errors/skips/cancel/changed identity. State Cancelled/TimedOut can precede return; keep UI busy/unreaped while worker_returned=false. A timeout-returned report can describe Cancelled scanner evidence while control remains TimedOut; retain both facts and partial coverage.

Dropping a dispatcher requests cancellation/closes progress without blocking the UI. It detaches a still-running thread; the worker's permit remains held until it really exits, preventing another admitted scan from accumulating alongside blocked I/O. Drop therefore is NOT hard shutdown/reap evidence. Cooperative cancellation cannot interrupt OS metadata/open/read. Hard parent-process kill/reap and restricted-worker integration remain required for bounded wall-clock cleanup/hostile files. No installed scan capability is enabled.

Errors have fixed path-free strings: Busy, InvalidSelection, InvalidDeadline, WrongOperation, Unavailable (counter exhaustion/spawn setup), WorkerFailed (conversion/panic). WorkerFailed persists across polls and never produces a success snapshot; the joined failed session can be cleared. Fresh job allocation never wraps. Panic-hook text is not forwarded to the UI; do not collect raw worker diagnostics.

## Consumer sequence

Trusted native picker registers selected benign path → start once → capture returned ticket → poll for matching progress/state/report → show precise partial evidence → after worker_returned clear matching session. On selection/view change: abandon old ticket → invalidate presentation → poll/reap old worker → clear → register new picker result/start fresh. Never release admission based only on elapsed time/cancel request, or treat a missing snapshot as zero/clean. Native endpoint authority, handle identity and stale UI reducer remain separate reviewed work.

Example local calls:

```rust
let ticket = dispatcher.start(&registry, &selection_ref, Duration::from_secs(10))?;
let snapshot = dispatcher.poll(&ticket)?;
// UI adapter renders state AND worker_returned, plus actual typed report.
dispatcher.abandon(&ticket); // before selection changes
// Continue polling; clear_returned succeeds only after actual join.
```

Acceptance: actual harmless file and folder dispatch/report/progress; stale/wrong ticket rejection, invalid selection/deadline, busy until explicit reap/clear; controlled held worker proves timeout is not return, abandonment suppresses output, drop retains global admission until worker exit, and panic remains WorkerFailed. These held cases are synthetic lifecycle scheduling tests, not blocked OS-read or hard-timeout evidence. No real GUI journey/event rehearsal claimed.
