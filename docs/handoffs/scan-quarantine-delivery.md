# Owner delivery goal: scanning, quarantine and download inspection

Owner request: 10 October 2026. Engineer A runtime branch:
`codex/engineer-a/issue-9-scan-quarantine`, stacked on Engineer B verifier
`91e0297230af2653269ae308943a210cac03e0c5` (PR59, itself on PR41).
Main integration is required after independent review and real supported journeys.
Do not merge the inherited PR41 unresolved findings merely to deliver this leaf.

## First recovery correction

Claim: https://github.com/LoopTryx/Sentinel/issues/9#issuecomment-6095188933

Editing files: `crates/sentinel-av/src/vault.rs` and new
`crates/sentinel-av/tests/vault_recovery.rs`. Preserve B's branch and dirty legacy
checkout. B explicitly reserved the runtime corrections to A in issue11.

Existing signatures remain:

```rust
Vault::quarantine(&self, source: &Path) -> Result<QuarantineOutcome, String>
Vault::restore(&self, vault_file: &str, to_path: &Path) -> Result<(), String>
Vault::destroy(&self, vault_file: &str) -> Result<(), String>
```

Restore only reads the existing 32-byte key; missing/damaged keys require recovery.
New quarantine cannot initialize a missing key while recovery blobs exist. New
key creation is exclusive, preventing a competing creator from overwriting it.
Blob references must be exactly 32 lowercase hexadecimal characters plus `.qtn`.
Restore creates a destination exclusively, writes and flushes it before removing
the recovery blob. Occupied destinations fail without modification. Write/flush
failure retains the recovery blob and may leave a partial destination; retry must
use a fresh explicitly selected destination. Blob cleanup failure returns an error
even when the restored file exists. No operation silently reports full success.

Examples: `restore("0123456789abcdef0123456789abcdef.qtn", selected_path)`;
`../anything`, absolute paths and malformed IDs fail. Callers must retain the
record on failure and show recovery-required/occupied/partial states. This API is
not authorization: only the native authenticated, explicitly authorized caller
may select source or destination. It is not yet approved for valuable files.

Evidence: three failing-first regressions reproduced key replacement, occupied
destination overwrite and deletion outside the vault using invented temporary
files. All 15 inherited AV tests plus five new recovery tests passed using
`cargo test --offline -p sentinel-av` with pinned GNU Rust 1.98.1. A standalone
probe imported the exact vault source while YARA compiled; it is supplemental,
not a substitute for the full crate. Full verifier and independent review remain
to be recorded at the published head.

Recovery publication: PR61 at `5a9b9d2`, stacked on PR59. Complete unchanged
`tools/verify.ps1` passed with pinned GNU and `CARGO_BUILD_JOBS=2`; the first
default-concurrency run failed with compiler OS112/disk space, not a code assertion.
Independent supplemental recovery review and five focused tests passed. B's
substantive security review is still required.

## Bounded scanner and inspection increment

A-reserved runtime/contract amendment:
https://github.com/LoopTryx/Sentinel/issues/9#issuecomment-6095438308

```rust
Engine::scan_file(path, hash_lookup) -> ScanReport
Engine::scan_file_with_control(path, hash_lookup, cancelled, progress, deadline)
    -> ScanReport
scan_directory_with_control(engine, root, hash_lookup, cancelled, progress, deadline)
    -> Vec<ScanReport>
inspection_snapshot(report_ref, &report)
    -> Result<FileInspectionSnapshot, InvalidFileInspection>
```

Use the application's singleton Engine; it admits one scan at a time with a
nonblocking mutex. Reentrant/concurrent requests return `busy`; dropping a call's
permit releases admission, including error/cancellation paths. This is per Engine,
not cross-process service admission. Native owner/job authorization remains needed.

The file reader acquires at most 8 MiB in 64 KiB chunks. Each progress callback
receives the current file's acquired-byte count; these are not completed-inspection
counts. The cancellation predicate is checked before access, between chunks,
before/after rule analysis and at final static-analysis completion. Use a sticky
native cancellation flag. A supplied monotonic deadline is clamped to 30 seconds.
Synchronous filesystem and YARA operations have cooperative checks; this is not
an OS-enforced hard timeout or restricted worker. YARA's documented timeout is best
effort. Download isolation capability must remain unavailable until its worker gate.

Directory traversal acquires at most 256 entries, retains at most 64 file/error
reports plus one limit/cancel/timeout terminal record, depth6, at most seven open
directory handles and at most 64 MiB acquired bytes overall. Remaining byte budget
is passed into each reader, including read-error/cancelled acquisitions. Keeping
seven handles avoids WalkDir's eager ancestor buffering at this allowed depth.
Root and discovered links are not followed; skipped links/depth/access/limit states
are explicit. Terminal traversal records are not scanned files and must not count
as clean files. Report-cap or exact budget exhaustion is conservatively incomplete.
Ordinary absolute local Windows paths only; UNC/device/verbatim/relative paths and
E: are rejected before access. Ancestry replacement remains outside this candidate's
authority guarantees; retained-handle identity review is still required.

Native states: `completed`, `partial`, `cancelled`, `timed_out`, `busy`,
`unsupported`, `failed`/`access_error`, `changed`, `engine_failed`, `limit_reached`,
`depth_limit`. Failed/cancelled/limited results never have verdict `clean`. The
native legacy string `clean` maps to wire `none_observed`, which only describes
completed configured checks. Overall coverage is always partial or unavailable.
No full SHA-256 is computed or reported for sampled files; a completed full-file
read can retain its digest even if a later engine stage fails.

Deep evidence measures zero bytes only in the acquired prefix. A logical file of
at least 64 MiB with at least 4 KiB inspected and at least 95% zero bytes in that range
produces `large_zero_filled_range`. It does not infer filesystem allocation or
describe uninspected tails. Legitimate sparse images/padding can trigger this clue;
never auto-quarantine based on it. A document/image extension with MZ plus a bounded
PE signature produces `disguised_executable_header`, not a malware verdict. Existing
bounded rules retain script/encoded/persistence indicators. No content is executed,
no archive is extracted and no universal payload-detection claim follows.

### Canonical public report

Source: `crates/sentinel-proto/src/file_inspection.rs`; generated bindings live in
`packages/contracts/src/generated`. Never hand-edit them. The output-only reference
is 1–64 ASCII alphanumeric/underscore/hyphen and confers no file/action authority.
The native adapter must bind it to the job, selected subject and private report.
All u64 counts are canonical decimal strings; validation rejects signs, leading
zeros, overflow, inconsistent ratios/counts/coverage/state/hash and oversized or
duplicate findings. `inspection_snapshot` emits only fixed enum finding codes,
not raw signature names/details, paths or contents. The raw native ScanReport is
not a browser/public output contract. Deserialize alone is not validation, and
this output type is not a newly enabled RPC request or transport decoder.

Safe sampled response example:

```json
{"reportRef":"report_2","state":"partial","verdict":"suspicious",
 "coverage":"partial","logicalBytes":"67108864","inspectedBytes":"8388608",
 "sha256":null,"evidence":{"zeroBytes":"8388608","zeroPermille":1000,
 "rangeComplete":false,"peHeaderPresent":false},
 "findings":["large_zero_filled_range"]}
```

No source-selection request or destructive action is inferred from this response.
Cancellation before access returns no content evidence/digest, unavailable coverage
and unknown verdict. B should discard stale report/job/selection references, render
terminal records as incomplete traversal, and retain error states alongside clues.
The old Tauri adapter currently treats unknown verdicts as clean and automatically
reopens paths for quarantine; it must not be enabled with these results until its
accepted ownership handoff, adapter correction and review. The old simulation
command still attempts EICAR creation and must become harmless-only before running.

Reproducible harmless acceptance:
`cargo test --offline -p sentinel-av` and `cargo test --offline -p sentinel-proto`
under pinned GNU 1.98.1. New tests cover 64 MiB zero fixture sampling, disguised header,
wide folders, missing-path cancellation/deadline, actual chunk cancel/handle cleanup,
per-Engine admission, aggregate acquired bytes, canonical counter limits and actual
native-to-path-free DTO mapping. Three old scanner cases failed before implementation;
three contract and two converter regressions also failed first, including an empty
file with a disguised filename (a filename clue still applies without content). Supplemental review
identified eager ancestor collection, entry257 and final-check omissions; corrected
before publication. Full final verifier/CI and B review must be recorded separately.

Scanner publication evidence: unchanged full `tools/verify.ps1` passed at
`d00b455` with two compiler workers, including native Rust tests, generated parity,
UI checks/build and extension checks/build. Supplemental review ran eight focused
AV cases and found no additional traversal/admission defect. Its remaining report
finding (impossible PE-header evidence below 68 bytes) was reproduced failing first
and corrected; four protocol cases, actual report conversion and strict protocol
lint pass after that correction. Named B security review, native UI acceptance and
installed-browser download acceptance remain pending. No issue is complete.

## Remaining concrete delivery work

1. Retained source identity, bounded encrypted staging, verified on-disk bytes,
   transactional journal and crash recovery; never delete a replacement pathname.
   Private Windows directory/ACL/no-follow handling and supported volume evidence.
2. Integrate the reviewed bounded scanner and public contracts into the native
   adapter, with visible progress/cancel/partial/error states. Existing main
   Node demo is a separate transitional route; do not mistake its 8 MiB skip for
   deep inspection or expand WPF into a competing permanent application.
3. Verify the bounded static content inspection in the actual native UI and
   retain benign controls. Optional additional formats need separate safe parser
   bounds/containment and evidence; do not claim uninspected archives are covered.
4. Actual supported Chrome download observation -> native subject-bound approval
   -> retained handle -> private bounded staged bytes -> isolated worker report.
   Desktop and extension must show the same report identity/digest/coverage.
   PR60 only prepares accounting/correlation, not this journey. Respect its
   separate platform/transport review gates and permission consent.
5. Agree Tauri/UI command ownership and generated canonical DTOs with B; native
   adapter signatures, limits, progress/cancel/errors and safe examples must ship
   with each increment. No synthetic completion, automatic remediation based on
   padding clues, or universal pre-execution protection claim.
6. Exact-head peer review, full CI, actual benign filesystem/quarantine/browser
   journeys and reviewed coordinator main integration; then verify a pinned
   usable build. All issue scopes remain open until their acceptance is met.

Defender remains enabled; E: untouched; no live malware, EICAR, real secrets,
automatic cloud upload or daily-machine device enforcement.
