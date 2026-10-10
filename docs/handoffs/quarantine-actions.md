# Job-bound quarantine actions

Authoritative contract: `crates/sentinel-proto/src/quarantine_action.rs`.
Seven TypeScript types are generated under `packages/contracts/src/generated`.
The native library controller is implemented; the proposed Tauri commands below
are **not registered**. Keep quarantine unavailable until independent security
review, authenticated native dispatch/confirmation and actual journeys pass.

## Functions and transport

```rust
SelectedJobs::prepare_quarantine(
    owner: &str, request: &QuarantinePrepareRequest, now: Instant,
) -> Result<QuarantinePreview, QuarantineError>

SelectedJobs::quarantine_after_native_confirmation(
    owner: &str, request: &QuarantineActionReference, now: Instant,
    vault: &Vault, native_confirmation: bool,
) -> Result<QuarantineReceipt, QuarantineError>
```

Proposed native commands: `quarantine_prepare(request)` returns a preview;
`quarantine_confirm(request)` opens an actual trusted native confirmation and
returns a receipt/error. The handler derives caller/window/session, vault and
fresh monotonic time. It must resolve the private subject associated with the
preview and show the actual source/action/recovery implications in the native
confirmation. Do not hold the controller mutex while waiting for the dialog;
reacquire and revalidate after it returns. `native_confirmation` is a trusted
handler result, never a browser Boolean. No owner, path, time, subject object ID
or approval field is accepted from a client. DTO validation is explicit after
deserialization and before output; references correlate state, not authority.

Prepare example: `{"jobRef":"job_demo_1","reportRef":"report_0"}`.
Confirm example: `{"actionRef":"action_demo_1"}`. These references are samples,
not preloaded capabilities. Example path-free preview:

```json
{
  "actionRef": "action_demo_1",
  "selectionRef": "selection_demo_1",
  "jobRef": "job_demo_1",
  "reportRef": "report_0",
  "expiresAfterSeconds": 30,
  "inspection": {
    "reportRef": "report_0", "state": "completed",
    "verdict": "none_observed", "coverage": "partial",
    "logicalBytes": "0", "inspectedBytes": "0",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "evidence": {"zeroBytes":"0","zeroPermille":0,"rangeComplete":true,"peHeaderPresent":false},
    "findings": []
  }
}
```

This is an illustrative empty-file report, not a protection verdict. A receipt
contains the four same references plus `vaultFile` (opaque32lowercasehex `.qtn`
reference) and `state`: `quarantined` or `original_retained`. Neither receipt nor
vault reference authorizes restore/delete; those require separate native approval
and selected destination/recovery handling.

## Lifecycle and failures

One pending preview maximum; a new valid preview supersedes the old action.
It expires inclusively30seconds after preparation. `expiresAfterSeconds` is a
display hint, not a client clock or granted lifetime. `maintain(Instant::now())`
also expires pending actions; its Boolean still reports selection expiry only.
There is no autonomous timer in this library. Native must provide bounded idle
maintenance and drop current UI previews on report/selection/job changes.

Only a joined, successful, uncancelled current job, with no newer selection and a
complete report carrying the private inspected-object association, can prepare.
Report references are canonical `report_0` through `report_64`, scoped to that
job and selection. Pending records store only bounded refs/owner/expiry. Source
path/object association is rederived from the matching private report, never the
request. Starting/selecting another subject or cancellation invalidates the
preview; late cancellation does not relabel already completed inspection data.

Foreign/unknown actions cannot consume another caller's preview. A recognized
action is consumed before decline, revalidation or filesystem work. Decline
permits a new explicitly prepared preview. An approved attempt also retires that
report's eligibility, before the vault operation, whether it succeeds or fails;
fresh inspection is required before another action on that report's subject.
At most65 eligibility bits are retained with the current job. The checked vault
revalidates original object ID/full bytes before mutation, as documented in
`scan-quarantine-delivery.md`; a token alone cannot approve a replacement file.

Errors are closed `{ "code": "action_unavailable" }` values: unavailable, busy,
invalid_request, job_unavailable, report_unavailable, action_unavailable, declined,
action_failed. Malformed/unknown fields refuse before filesystem work; a running
job is busy; foreign/stale jobs or report scopes cannot prepare. Expired,
superseded, consumed or foreign actions share action_unavailable.

`quarantined` requires the vault's original-removed receipt. `original_retained`
means an encrypted copy exists but the original remains; show that gap and require
reconciliation/fresh scan. `action_failed` may occur after partial durable writes
or removal, so do not claim unchanged files, silently retry or destroy recovery
data. Check native recovery inventory. No raw OS error, path or file content is
forwarded. Do not automatically act on heuristic findings or cloud explanations.

## Executed and required acceptance

Tests initially failed missing contracts/controller API. A further actual
regression then reproduced that old successful/failed reports could prepare new
actions; the bounded eligibility record now refuses both. Harmless real engine
worker/vault tests cover foreign/missing report refs, superseded/declined/replayed
actions, inclusive expiry, new selection/job, changed-source failure, completed
evidence after late cancel, original bytes/no-key refusal and exact restore.
The held real worker test refuses preview while busy. Confirmation Booleans in
tests exercise trusted-handler branches; no actual native dialog is inferred.

Reproduce with `cargo test --workspace --lib inspected_quarantine_tests`,
`cargo test -p sentinel-proto --test quarantine_action` and the existing
`scan_jobs` integration suite. Proto tests validate closed inputs, canonical
report indices, matched complete evidence, TTL and distinct retained receipts.
Run proto lib tests to regenerate bindings, then the full unchanged verifier.

Remaining: independent authority/failure/recovery review; native caller/window
authorization, actual picker/dialog/idle/shutdown and bounded isolated execution;
explicit restore/destroy approval; actual supported browser download-byte handoff
with the same report in both clients; reviewed integration into main. Preserve
Defender, E: and valuable-file gates. No installed capability or issue completion
is claimed by these component tests.
