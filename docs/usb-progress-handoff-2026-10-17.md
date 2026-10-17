# USB Guard progress and continuation — 17 October 2026

This is a source-progress checkpoint for PR #74, not a release or a completed persistent-blocking claim. Branch: `codex/engineer-a/issue-12-usb-approval-recovery`; stacked base remains `codex/engineer-a/desktop-v2-20261013`. No code is merged to main by this publication.

## Delivered source

- USB Guard is presented inside the existing console. Native read-only discovery is prompt-free; external devices receive session-bound opaque references. Built-in safety candidates are excluded from actionable rows. Failed refresh retains visible inventory with stale status and disables actions. Device confirmation precedes elevation/Hello. Arrival notices dismiss after five seconds when no action is active.
- The old class-wide admission action is centrally disabled (`DeviceScopeQualified=false`). Allow uses selected-device recovery and refuses an active shared restriction; it cannot silently rearm the shared deny. This containment preserves the ordinary controls the owner restored by restarting Windows.
- Native tab IPC validates bounded framing, strict UTF-8, request/reply nonce, process/start/session identity and pipe access. It supplies no browser-minted authorization. Existing Windows Hello owner verification is preserved.
- Protected cleanup, legacy retirement binding and native worker source include explicit failure handling and qualification tools. The new exact-overlay lease requires the previously authenticated binding before accepting its read-only validator; old callers still require an empty legacy deny list.
- Persistent exact-block candidate: authoritative Rust `SNTINP04`, immutable committed/pending state, target-only generation changes, protected atomic file storage, shared commit/recovery decision lock, and saved/effective **private-path-only** GPO adapter. Successful committed state has no expiry; deadlines apply to interrupted updates.
- The exact native authority adapter reuses the original foreground/session-bound Hello proof with full transaction digest and fresh external-target classification. It is not yet wired to a production exact-block worker.
- The recovery scheduler source is a dormant work-in-progress contract. It is not an installed or qualified SYSTEM recovery implementation. Its native registration and lifecycle must be independently qualified before use.

## Evidence and its limits

Actual owner-approved private native qualification passed:

1. Protected committed state survived a fresh process. Recovery claim fenced late commit; post-commit recovery preserved the candidate.
2. Actual private saved/effective local GPO apply, readback, final removal and cleanup passed. A private legacy baseline survived two blocks, Allow-one and Allow-last.
3. The manual private native adapter used the actual durable writer fence around Save/refresh/readback. Block B and Allow A preserved B. Recovery claim restored the precommit state and refused late commit; final removal restored the private baseline.

The third harness deliberately throws for independent SYSTEM recovery and producer-quiescence methods. Its phase preparation is manual, explicitly not evidence of a registered watchdog. None of these private runs changes DeviceInstall restrictions, proves physical input blocking, or proves persistence through a Windows restart.

Fresh publication checks: USB crate tests and strict all-target Clippy pass with native access to disposable HKCU; TypeScript typecheck, UI tests and build pass; focused native/C# tests, IPC and console compile pass. Recovery scheduler pure contract tests pass, but WorkingDirectory validation, own-task retirement and actual SYSTEM/boot acceptance remain pending. No recovery task was registered.

The unchanged full `tools/verify.ps1` did NOT pass on this publication run. Its initial sandbox run failed dependency-build filesystem access. The native-access retry passed formatting and workspace Clippy, then workspace tests failed to compile `sentinel-av` with E0463/missing rlib errors (including zlib_rs/zopfli/simd_adler32). Cause is not established; no unrelated antivirus source or verification gate was changed. The later UI checks were run separately and passed. This remains a full-workspace verification blocker, not a passing full check or hosted-CI result. Focused exact-state, 344 modeled transaction fault cases, private GPO image, exact authority, device-action/recovery/selection, tab model/framing and actual subprocess IPC tests pass. Disposable HKCU legacy-overlay validation passes; it is not authenticated production-lease proof. The console main executable compiles from current build-script inputs into a separate output directory; the installed app is unchanged.

Reproduce source checks from repository root:

```powershell
./tools/usb/tests/test-usb-exact-block-state.ps1
./tools/usb/tests/test-usb-exact-block-transaction.ps1
./tools/usb/tests/test-usb-exact-block-gpo.ps1
./tools/usb/tests/test-usb-exact-block-native-authority.ps1
./tools/usb/tests/test-usb-admission-tab-model.ps1
./tools/usb/tests/test-usb-admission-tab-pipe.ps1
./tools/usb/tests/test-usb-admission-tab-pipe-native.ps1
./tools/usb/tests/test-usb-legacy-exact-overlay.ps1
./tools/verify.ps1
```

Build private native tests using their `build-usb-exact-block-*-qualification.ps1` scripts. Run only the reviewed binaries through explicit Windows elevation: `UsbExactBlockPrivateQualification.exe --private` and `UsbExactBlockNativeBackendQualification.exe --private-manual`. These create private registry/file fixtures and refresh computer policy; they are not ordinary non-privileged unit tests. Do not substitute their results for real device acceptance. Raw machine identities and private receipts stay out of Git.

## Engineer B coordination

Freshly fetched Engineer B branch `prattyush-changes-for-v3` at `ee04077` contains the latest backdrop/sidebar/navigation work. It was inspected but not edited, reset, rebased, cherry-picked or merged. Existing Engineer B designs remain the presentation baseline. Unrelated local `apps/desktop/NativeConsole.cs` is preserved and excluded from this publication. No generated distribution, local credentials, private runtime state or binary installers are included.

Shared-file integration is for peer/coordinator review on this PR. Do not replace B's current UI with this branch wholesale; port the reviewed USB bridge/view delta onto the agreed integration head and verify both journeys. Owner-visible success on one old build must not be applied to a different executable by assumption.

## Exact next steps / continuation prompt

Continue PR #74 from its published head. Read this file, `usb-guard-inline-tab-contract.md`, `proposals/usb-persistent-exact-blocking.md`, and `work/usb-persistent/`. Preserve all peer work and the current containment gate.

1. Finish the independent exact-block worker/backend with pinned installed image, protected state, authenticated SYSTEM deadline/boot retry, bounded producer jobs and verified retirement. Reuse existing job/task principles without rewriting the temporary backend. No successful no-op recovery methods.
2. Join authenticated retired-baseline preservation to the production saved/effective adapter. Private legacy simulation does not authenticate the live lease. Preserve unrelated policy and refuse drift.
3. Qualify real independent precommit rollback, postcommit preservation, late-writer fencing, bounded hangs/descendants and startup recovery using private synthetic subjects. Review the scheduler's self-recovery retirement and interrupted-retirement path before activation.
4. Connect exact request preparation and existing Hello verification to Block/Allow. Resolve targets afresh in native code; never accept IDs, owner SID, proof or policy from the WebView. Never call the old class-wide ApplySelection from a device button.
5. Verify selected-device Block and Allow, preservation of another blocked device, unaffected normal controls, and owner-confirmed actual restart persistence. Show restart-required truthfully; never force-disable a critical device or automatically reboot.
6. Only then enable the capability and seek reviewed coordinator integration. Keep issues open until acceptance is satisfied.

Defender stays enabled; CRYPTIC (E:) stays untouched. Do not change machine policy merely to reproduce this source checkpoint. The prior owner-overridden daily-device test permission does not waive Windows authorization, recovery requirements or truthful evidence.
