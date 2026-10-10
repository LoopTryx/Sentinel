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

## Bounded quarantine storage follow-up

Plaintext admission is at most 8 MiB, key input exactly 32 bytes, encrypted blob
input at most 8 MiB plus the 12-byte nonce and 16-byte authentication tag.
Each reader checks ordinary-file metadata before/opened/after access, rejects
final symlinks/reparse points and uses a bounded read (at most limit plus one
overflow sentinel byte). Windows sharing excludes writers/deletion during that
read. No ancestry or subject authorization is inferred from these checks.

New encrypted blobs use exclusive creation, write and flush, then reread and
authenticate the actual stored bytes before the old source-removal step. A write,
flush or verification failure retains the source; a partial blob can remain and
must be treated as recovery-needed. Storage has no total quota/journal yet.
Source pathname removal after closing the read handle remains unresolved, as do
restore/blob-cleanup identity, ancestors, private ACLs and crash recovery. Do not
enable automatic or valuable-file remediation on the strength of these tests.

A harmless 9 MiB source regression failed before correction (the old code accepted
and removed it). Eight focused recovery cases pass afterwards, including an exact
8 MiB roundtrip with a blob 28 bytes larger, an oversized preserved key and an
oversized preserved blob. Strict AV lint and the native AV suite passed before the
added boundary case; that boundary case also passed. Supplemental independent
review found no introduced Windows leaf blocker and ran the earlier seven cases.
This is not designated B security approval or actual application acceptance.

## Windows retained-handle follow-up

The next candidate supersedes the Windows source/cleanup pathname-removal gaps
above: bounded destructive opens request read plus DELETE access, sharing mode
zero and final-component no-follow. Quarantine keeps the exact source handle
through encryption, then verifies flushed recovery bytes by seeking/rereading the
same exclusive output handle. Only then does it mark the held source for deletion
with `SetFileInformationByHandle(FileDispositionInfo)` and close it. No source
pathname is reopened for removal. Disposition failure returns `original_removed`
false with the verified blob retained; callers must show incomplete remediation.

Restore retains the authenticated blob handle and the exclusively created output
through write/flush and blob disposition. Cleanup failure returns the existing
recovery error. Destroy uses a retained bounded blob handle. Existing readers,
writers or deletion/rename handles prevent destructive admission; there is no
privilege elevation or fallback pathname deletion on Windows. Ordinary read-only
key input retains read-sharing. This API still lacks selected-subject/action
authorization, ancestor/private-storage authority, quotas and crash journaling.
Non-Windows inherited pathname cleanup remains unapproved for real remediation.
Deleting one selected hard link does not remove all aliases or establish universal
execution prevention. Windows-only enablement still requires B security review.

The Microsoft contract requires DELETE access for the held-handle disposition:
https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle
The direct Windows-only dependency is existing pinned `windows-sys` 0.61.2 with
FileSystem features; no permissions, RPC or UI surface changes accompany it.
The new harmless Windows held-handle test failed first with a deletion stub, then
passed with actual disposition; another test proves existing readers refuse
admission and unmarked handle close preserves the source. Recovery eight cases
and native AV tests passed during development; final exact-head verifier/review
must be recorded separately. Defender is unchanged and all paths are fresh temp
fixtures, not E: or selected valuable files.

## Encrypted recovery journal candidate

After verifying the persisted encrypted blob, quarantine creates an exclusive
`.qjr` journal and flushes authenticated encrypted source association, digest and
byte count before disposing the held source. A second flushed record reports
whether removal succeeded. Records use fresh AES-GCM nonces and bind to the exact
vault reference as authenticated additional data. Reads cap the journal at 8192
bytes and each encrypted frame at 2048 bytes; private source paths never appear
in the native summary or diagnostic errors.

Native signature: `Vault::recovery_summary(&self, vault_file: &str) ->
Result<RecoverySummary, String>`. Use only the generated vault reference returned
by quarantine, for example `0123456789abcdef0123456789abcdef.qtn`. The summary
contains `vault_file`, `phase`, canonical decimal `plaintext_bytes` (for example
`"24"`) and the SHA-256 hex digest. It grants no action authority and is not an
exposed RPC or browser DTO. `RemovalRecorded` and `SourceRetainedRecorded` are
historical authenticated receipts, not proof of current blob availability,
current source state or protection. The following lifecycle increment records
restore/destroy separately; neither receipt is a live inventory proof.

A verified initial record without a valid terminal record returns
`RecoveryRequired`, including truncated or corrupt trailing records. Missing,
oversized, unauthenticated or cross-reference journals fail explicitly. Legacy
blobs remain explicitly restorable without guessing their missing journal state.
If terminal journal writing fails after removal, quarantine returns an error,
but the verified blob and initial recovery record remain; consumers must inspect
recovery rather than assume every error means the source was preserved.

The native AV suite passed 40 tests and strict clippy passed. Controlled test-only
returns immediately before and after held-source disposal both retained
authenticated recovery and restored harmless bytes exactly to a new target.
Journal tests cover encryption, reference binding, oversized input, tampering,
truncated terminals, 1/2/3-byte trailing data and legacy missing journals. The
trailing-data regression failed before correction. Supplemental independent
review passed interruption and journal tests; designated B review remains due.
These are controlled-return tests, not process-kill, filesystem directory-entry
durability or power-loss evidence. Full exact-head verification is recorded
separately after committing. Storage ACL/ancestry, quotas, recovery inventory,
interrupted lifecycle resumption and actual application acceptance remain open.

## Restore/destroy lifecycle candidate

Explicit restore/destroy now create an exclusive encrypted `.qlj` receipt using
the same 8192-byte total and 2048-byte encrypted-frame bounds. Restore writes and
flushes an exclusively held destination, rereads the same handle and compares
persisted plaintext before recording/flushing restore intent. Destroy first
authenticates the bounded encrypted blob, then records/flushed deletion intent.
Both retain the intent handle through held-blob disposition and append/flush
completion only afterward. Restore's target association remains encrypted and
is omitted from the native summary. Deletion is not secure erasure.

`recovery_summary` prefers an existing lifecycle receipt; inaccessible, malformed
or unauthenticated lifecycle data cannot fall back to the earlier quarantine
receipt. Valid intent alone or torn completion returns `RecoveryRequired`.
Complete native phases are `RestoredRecorded` and `DestroyedRecorded`, historical
receipts only. They do not prove current destination contents or blob absence.
Legacy blobs without `.qjr` remain explicitly restorable with a new lifecycle
receipt. Occupied receipts are never overwritten: the operation fails while
preserving the encrypted blob and any already verified restored destination.
An existing incomplete receipt currently blocks a retry; authenticated explicit
resumption/reconciliation remains required before release. A final receipt-write
failure after disposition leaves an intent-only record and reports an error;
callers must not infer that an error always means the blob was retained.

The stale receipt regression failed first (`RemovalRecorded` after restore),
then passed with actual byte-exact restore and authenticated destroy. Five
journal/lifecycle tests cover target secrecy, intent-only/torn completion,
occupied receipt preservation, malformed lifecycle refusal without fallback and
corrupt-blob destroy refusal. AV43 and strict lint passed locally. Full committed
head verification and independent review are recorded separately. No actual
process termination, power-loss, storage ACL/ancestor or UI/browser acceptance is
claimed; designated B security approval remains required.

## Windows aggregate storage admission candidate

All mutating quarantine/restore/destroy/resume entry points now retain an
exclusive Windows `.admission.lock` regular zero-byte handle through writes and
source/blob disposition. The handle uses no-follow and sharing zero; its own
metadata rejects reparse/nonregular/nonempty input before enumeration. A held
admission handle causes another mutation to refuse, rather than queue an
unbounded job. The persistent infrastructure file is excluded only after this
validation, including the fresh-key recovery check. It is never automatically
removed or treated as evidence of process liveness.

Admission enumerates at most 129 non-lock entries, rejects directories/symlinks/
reparse children and traversal/metadata errors, counts all regular logical file
sizes (including unknown files), and uses checked arithmetic. Limit: 64 MiB and
128 projected entries. Each canonical blob lacking a lifecycle receipt reserves
one future entry and 8192 bytes; existing lifecycle receipts reserve growth to
8192 bytes. The selected lifecycle operation converts only its own future
headroom into its current write reservation. New quarantine reserves blob bytes
plus two 8192-byte journals and three entries. Restore/destroy reserve 8192 bytes
and one lifecycle entry; resume reserves 2052 bytes, including the four-byte
frame prefix. The retained admission handle serializes cooperating Windows
writers. Non-Windows admission is explicitly unsupported.

Capacity or admission errors preserve sources/recovery blobs without automatic
cleanup. Normal app population retains recovery headroom; unknown external files
can still exhaust it and make recovery refuse. Clients must show incomplete
recovery and never assume a generic error means an earlier deletion did not
happen. Private storage ACL/ancestor authority, filesystem free-space availability,
process/power-loss evidence and selected subject/action authorization remain
separate gates. No UI/RPC/permission change accompanies this runtime candidate.

The initial quota regression was masked by missing-key refusal; with a known
synthetic key it failed because a full store was accepted and the source removed.
Full logical-byte and entry-count controls now preserve source/key. Four capacity
cases also cover exclusive admission, unsupported children and restoring or
destroying every accepted item near the entry limit. Independent review found
normal-population recovery starvation and a missing four-byte frame prefix; both
were reproduced red and corrected. The prefix boundary test refuses at 2051 bytes
remaining and succeeds at 2052. AV49, formatting and strict lint passed.
Supplemental independent review passed capacity 4/4, prefix 1/1 and interrupted
resume 1/1, with no new accounting finding. Full exact-head repository verification
and designated GLM/coordinator review remain separately recorded requirements.
All fixtures are harmless owned temporary files; Defender unchanged, E: untouched.
## Remaining concrete delivery work

### Explicit resumption candidate

Native APIs: `Vault::resume_restore(&self, reference: &str, target: &Path) ->
Result<(), String>` and `Vault::resume_destroy(&self, reference: &str) ->
Result<(), String>`. These are explicit actions, not startup automation, RPC
authority or UI integration. Example: pass the exact `.qtn` reference returned
by quarantine and the explicitly selected absolute target previously recorded
by the interrupted restore. No inferred target, overwrite or plaintext path is
returned in the path-free historical summary.

Resumption holds the bounded lifecycle journal exclusively for read/write and
requires exactly one authenticated complete intent frame. The reference AAD,
action stage, exact absolute association, byte count and fresh SHA-256 must
match. Terminal, torn, trailing, malformed and different-subject records fail
without journal truncation/replacement. Restore retains and freshly checks the
existing destination bytes; an extant blob must authenticate and match those
bytes before held-handle cleanup. If the blob was already removed, freshly
verified destination bytes allow recording historical restore completion.
Destroy resumption requires an extant authentic blob and refuses missing bytes;
absence is not evidence of secure erasure. Non-Windows resumed cleanup fails
explicitly. Ancestor/private storage authority and job/action binding still
require their release gates.

The live four-boundary test now exercises actual resume: both restore cases
complete with unchanged bytes; pre-disposition destroy completes; missing-blob
destroy stays recovery-required. Wrong target, changed destination and trailing
intent are refused with receipt/blob state preserved. Test setup repairs only
its own synthetic fixtures; production APIs never repair them implicitly.
Offline AV44 tests passed in the normal sandbox, and supplemental independent
review passed the focused adverse/resume test with no Windows regression found.
The first test build failed because the resumption APIs were absent. The earlier
sandbox/configuration access and automatic approval-review usage failures were
recorded without claiming a successful verifier. Approval review has recovered:
formatting, strict AV clippy and offline AV44 tests now pass. The previous pushed
head 4033642 also has two completed successful GitHub verify checks; this does not
verify the new edits. Full committed-head verification is recorded separately.
Exact resumption claim: issue9 comment6096418233. Current owner instructions use
Codex logic/runtime and GLM presentation, with independent GLM/coordinator review
and actual native/Chrome acceptance still required. No peer presentation edit or
main code integration accompanies this candidate.

The follow-up Windows unit `interrupted_restore_and_destroy_preserve_exact_intent_boundary_state`
executes restore and destroy with controlled returns at two live boundaries:
immediately after flushed intent and immediately after held blob disposition,
before completion. It failed with ignored fault points and passed after adding
the test-only returns. All four cases retain authenticated recovery-required
receipts and correct byte counts; blob presence matches the actual disposition
boundary. Both restore cases preserve the byte-exact destination. Ordinary
destroy retries fail without modifying the intent receipt. The enum, extra
parameters and fault branches are compiled out of production. These are
controlled-return ordering checks, not actual process termination or power-loss.
Explicit authenticated resumption/reconciliation remains the next runtime task;
existing intents are not silently overwritten to make retries appear successful.

CI job 114173382527 failed the directory budget test at 40 MiB because its
five-second test deadline expired before the 64 MiB budget. The test now supplies
the existing 30-second production cap; production timeout behavior is unchanged
and expired-deadline coverage remains separate. The corrected focused test passed
locally in 3.36 seconds. The initial full journal verifier encountered linker disk
exhaustion, not a test assertion; six obsolete test executables from this issue's
earlier runs were removed before retrying. Final exact-head verification and CI
results must be recorded independently.

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

## Windows storage ancestry candidate

Codex issue9 claim6096815593 covers vault.rs, internal storage_path.rs, lib.rs
module declaration and tests/vault_ancestry.rs. Storage initialization now validates
all lexical components before creating any directory. Supported input is an
absolute ordinary local fixed-drive path, at most1024 UTF16 units/32 components;
relative, device/remote/verbatim prefixes, traversal, ADS, reserved DOS basenames,
trailing dot/space and excess bounds refuse. The retained root's final DOS path
must match the supplied drive root. Missing directories are created individually
under previously retained parents. Constructor signature remains `new(&Path) ->
Vault`; failed initialization leaves operations unavailable rather than silently
falling back to redirected storage.

Every storage ancestor is opened with nofollow/backup semantics, directory-list
and attribute read access, and read sharing only. Metadata from each held handle
must show an ordinary directory without reparse attributes before its next child
is accessed. Guards remain live throughout quarantine, restore, destroy, both
resume APIs and historical recovery_summary, before key/blob/journal reads or
writes. A changed public dir/key-parent association refuses. These handles block
ordinary directory rename and write-handle acquisition during the operation.
The first attributes-only handle attempt failed the real leaf-rename test;
requesting directory-list read access corrected that observed Windows behavior.
See Microsoft CreateFileW sharing/directory semantics:
https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew

Two initial integration regressions failed before implementation: intermediate
or leaf junctions redirected initialization/mutation, and traversal/reassigned
dir was accepted. They now pass without modifying redirected storage or original
bytes. Four integration tests cover those cases, post-initialization ancestor
replacement refusing every vault operational API, and unsupported names/depth
before creation. The held-ancestor unit refuses ancestor/leaf rename and writable
open while retained; after drop, write open and rename succeed. AV54, strict lint
and formatting passed. Supplemental final review and committed-head full verifier
are separately recorded; all junctions and bytes belong to harmless tempfixtures.

This closes ordinary storage junction traversal and retained directory rename
checks, not the full storage authority gate. Child/file opens still use DOS drive
paths: drive-letter namespace remapping is an untested boundary requiring stable
volume-pinned or handle-relative access before stronger authority claims. Private
ACLs, source and restore destination ancestors, explicit subject/action binding,
actual process/power-loss evidence and native/Chrome acceptance remain required.
No permission changes, peer adapter/UI edits, enabled remediation or main code
integration accompany this candidate. Defender unchanged; E: untouched.
## Volume-addressed storage candidate

Codex issue9 claim6096905013 retains the public `Vault::new(&Path)` and operational
signatures, but separates configured/display storage from private I/O addresses.
During successful initialization, the held fixed-drive root is resolved with
GetFinalPathNameByHandleW/VOLUME_NAME_GUID before any descendant creation or open.
All following initialization paths use that volume address. The private key path
retains it for this Vault instance, and each operation validates/reholds its
bounded canonical volume ancestry. Keys, admission, blobs and journals use the
scoped volume-addressed Vault, never a later DOS drive-letter lookup. Public dir
reassignment refuses; public dir remains legacy configuration/display, not action
authority. Original destroy association strings remain authenticated metadata
only, preserving earlier receipt reconciliation without using them for I/O.
Microsoft API contract:
https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew

Failed initialization is explicitly unavailable for all six operational APIs;
it does not become usable after external path repair. Reconstruct only after
reviewing/fixing configuration. A supplemental reviewer found that a caller's
already-valid GUID path could survive the first fallback implementation. The new
regression reproduced accepted mutation before an explicit initialized marker
was added; now refusal retains source and creates no key. Public caller GUID/
device paths remain unsupported; internally captured GUID paths must have a
canonical Volume UUID prefix, fixed root and matching held final volume path.

Falling-first volume regression checks an anchored private key, a real byte-exact
quarantine/restore and reconciliation of an original-display-path destroy intent.
It failed with DOS addressing and passed after the correction. AV56, strict lint
and formatting passed. Supplemental independent volume roundtrip1/GUID refusal1
and prior ancestry4 passed; no remaining unsafe fallback or residual operational
DOS storage I/O finding. Committed-head full verifier and designated review/CI
are separate requirements. No drive mappings, account permissions or volume
configuration were changed; all bytes are harmless owned temporary fixtures.

This addresses ordinary DOS drive-letter lookup for this instance's storage I/O,
not privileged volume namespace replacement, identity across initialization or a
new constructor, private ACLs, source/restore target ancestry, selected action
binding or process/power-loss durability. Native adapter ownership and actual
supported desktop/Chrome scan/download/report journeys remain pending. Next
runtime gate: private storage ACL policy and source/target authority. No main code
integration or enabled remediation; Defender unchanged and E: untouched.
## Selected file ancestry candidate

Codex issue9 claim6096994338 covers storage_path.rs, vault.rs and the new
vault_subject_ancestry.rs tests. Public operation signatures remain unchanged.
Selected quarantine source, restore destination and resume destination use a
bounded ordinary absolute fixed-local-drive path. Validate the full raw selected
path before extracting the filename: dot traversal, trailing separators, ADS,
reserved names and trailing dot/space refuse. Parents retain the storage ancestry
policy (1024 UTF16 units, 32 directory components, no reparse ancestors), with
GUID-addressed I/O from the retained volume root. Include the filename in the
resolved bound before any missing parent creation. Restore creates each missing
parent under its already held ancestor instead of create_dir_all. These guards
remain live through source disposition or target verification and terminal
receipt; the restore output's exclusive handle remains held through its receipt.
No action is inferred from inspection flags and no native adapter is enabled.

Real owned-temp failing-first regressions reproduced source-junction mutation,
resume through a junction cleaning authenticated recovery state, raw trailing-dot
filename normalization, and resolved overlength creating missing directories.
All now refuse and preserve original/recovery bytes; source refusal creates no
key/blob. The restore-junction case already refused before this leaf and is a
control, not a newly reproduced bug. Nested-parent restore still returns exact
original bytes. Focused ancestry5 and resume1 passed. Full AV62, strict clippy
and formatting passed on Windows GNU 1.98.1. Supplemental review and exact
committed-head verifier/CI are recorded separately in PR61.

Reproduce: cargo test -p sentinel-av; cargo clippy -p sentinel-av --all-targets
-- -D warnings; cargo fmt --all -- --check; then unchanged tools/verify.ps1 on
the committed candidate. Tests use harmless owned tempfiles and junctions;
no malware/EICAR, permission changes, Defender changes or E: access.

Remaining authority gates: private storage ACL policy, subject/job/action binding
and identity across requests/initialization, privileged namespace bypass and real
process/power-loss recovery evidence. Native adapter ownership handoff remains
pending; actual supported desktop/Chrome scan/download/same-report journeys,
designated review and coordinator main integration remain required. This leaf
is a runtime correction, not shipment or whole-issue completion.

## Read-only private-directory policy candidate

Codex issue9 claim6097112129 adds `Vault::validate_private_storage(&self) ->
Result<(), String>`. This is a read-only current-process directory policy probe,
not permission repair or authorization. The existing retained volume ancestry
must succeed. Inspect both the key's parent and nested vault directory using
nofollow read-control handles. Query a bounded aligned self-relative descriptor
and current process TokenUser (each <=64KiB). Require current-user ownership,
protected present nonnull DACL, <=256-byte ACL and one or two ordinary explicit
allow ACEs: current owner full-control with object/container inheritance is
required; SYSTEM with the same flags/rights is optional. Refuse inherited grants,
foreign principals, unsupported ACE types/flags/masks, duplicate grants, null or
empty ACL, missing owner grant, unavailable metadata and unsupported platforms.
No SID or raw descriptor is returned, logged or sent to AI. Result example:
`vault.validate_private_storage()?` verifies these two directory snapshots;
Err is unavailable/unsupported and must never become a clean/protected verdict.
Microsoft handle-query contract (read-control required):
https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-getkernelobjectsecurity

Actual Windows owned-temp directories test private owner+SYSTEM acceptance,
owner-only acceptance, broad read on vault refusal, broad read on key-parent
refusal despite a private vault, and inherited directory refusal with no key
creation. A failing-first unavailable stub rejected the positive descriptor.
The first setup protected only app_data, so its nested inherited vault correctly
refused; the fixture now explicitly protects both actual directories rather
than weakening the policy. Focused4 pass. Static supplemental security review
found no unsafe buffer/lifetime or permission-write issue. Full verifier/CI and
any independent executed evidence are recorded separately in PR61.

At the historical 7d9c77a candidate, operations did not yet enforce this gate.
The following private-creation/enforcement candidate supersedes that state.
A directory snapshot alone
cannot validate key/blob/journal/admission-file ACLs or prevent later DACL changes
by the owner or privileged processes. Private creation and child-handle policy,
enforcement before every sensitive operation, subject/job/action authority and
installed native/browser acceptance remain required before valuable-file use.
The production probe never changes any permissions. Only fresh owned temporary
fixture directories receive explicit test descriptors through .NET creation;
no existing path ACL, account privilege, Defender or E: was changed.

## Private creation and enforced storage policy candidate

Codex issue9 claim6097213844 supersedes the read-only-only stage. Public Vault
signatures remain unchanged. Initialization now creates each missing storage
directory atomically with an explicit protected owner/SYSTEM full-control OI|CI
descriptor through CreateDirectoryW, under previously retained nofollow volume
ancestry. It validates the app/key parent before creating the nested vault and
opens that child using its captured GUID address while parent guards stay held.
The filename-inclusive future bound is checked before missing-parent creation.
Existing directory ACLs are never repaired or expanded: inherited/broad or
unsupported app/vault storage returns an unavailable Vault, preserving existing
content and requiring an explicitly selected fresh private location or separately
reviewed recovery. No silent legacy-key migration or permission repair occurs.

Every operational storage_guard checks key parent and vault policy before key,
admission, blob or journal access. Retained private child handles validate actual
owner/DACL before reading key/blob/journal bytes or writing newly created key,
blob/journal bytes. Admission lock validation precedes storage mutation. Files
accept only current-owner full-control plus optional SYSTEM full-control, with
ordinary explicit or inherited ACEs (flags0 or INHERITED_ACE); directories still
require the protected explicit inheritable policy. Unsupported/null/foreign/
extra grants fail. New key creation uses nofollow/share0. Selected source and
restore destination use their separate ordinary-file identity/ancestry policy;
this storage policy must not accidentally demand private ACLs on user documents.

Reproduction: cargo test -p sentinel-av --test vault_privacy (7 cases), then
cargo test -p sentinel-av and strict clippy; unchanged tools/verify.ps1 on the
committed candidate. Fresh private initialization and refusal before nested child
creation reproduced failing-first. Broad-key fixture initially failed setup
because the child PowerShell process could not autoload its Security module;
using direct .NET AccessControl methods corrected that fixture. Do not label its
initial setup failure as a reproduced scanner defect. Actual broad key/blob/
journal/admission refusals now preserve benign source/recovery bytes; private
owner-only and owner/SYSTEM locations accept. Existing bounded real roundtrips,
ancestry, capacity and recovery cases pass with private initialization. Static
supplemental review found no creation lifetime, coverage or mutation-order issue;
executed independent and committed-head complete evidence is separately recorded.

Production does not modify an existing ACL, enable a privilege, change accounts,
Defender or E:. Test ACL broadening is limited to disposable owned benign files,
never real credentials/content. No raw descriptor, SID or file contents are sent
to AI or diagnostics. This policy protects the supported ordinary cross-user
storage boundary, not the same owner/privileged actor changing DACLs, hardlink or
volume identity across requests, or real process/power-loss durability. Explicit
subject/job/action authorization, native ownership handoff and supported browser
byte/download/same-report acceptance remain required before shipment/main.


## Existing hardlink refusal candidate

Actual harmless Windows hardlink regression reproduced quarantine deleting its
selected name while another name retained the bytes. The retained opened input
now queries GetFileInformationByHandle before reading private storage or any
input opened for deletion. Unknown identity or nNumberOfLinks other than one
refuses before source bytes, key creation or source disposition. Key/blob/journal
hardlink refusal tests preserve recovery blobs and create no restore target.
Ordinary file/ancestry/recovery cases remain supported. This is refusal of
existing multi-link inputs at the held-handle boundary, not authorization across
requests or protection against a privileged/same-owner concurrent namespace
change. No global hardlink discovery, alias removal or automatic remediation.

Reproduction: cargo test -p sentinel-av --test vault_subject_ancestry (7 cases);
cargo test -p sentinel-av and strict clippy passed. Full committed-head verifier
and designated peer review evidence must be recorded separately. Supplemental
review attempt failed due reviewer account usage limit, so no independent review
is claimed for this leaf. Native ownership is now accepted by B (issue9#6097899046),
and owner-directed acceptance/handoff of B requests is recorded in issue9#6099690474
and issue12#6099690602. Next A work is the authoritative bounded native scanner
selection/start/poll/cancel contract and implementation; B owns the handed-off
independent USB foundation, with original hardware/privileged safety gates.
