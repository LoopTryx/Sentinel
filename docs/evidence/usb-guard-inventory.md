# USB Guard observation increment

Issue: #11, with #12 runtime coordination. Base: `459afbf332a504442dd789bf0be981432fc8ae6a`. Branch: `codex/engineer-b/issue-11-usb-guard`. Reviewer: Engineer A; integration: coordinator.

Adds a desktop USB Guard route, bounded local inventory import and a read-only Windows PnP collector. Risk, coverage, freshness and operating mode are separate. Composite storage/HID exposure, unresolved ancestry, network exposure, empty observations and stale/partial/unavailable reports remain explicit. There is no assertion of malware detection or BadUSB prevention.

Native scanner adapters and generated contracts remain Engineer A's claim. No privileged authority, scanner implementation, vault, quarantine, device policy or generated contract is changed. HID permission actions remain disabled. Production antivirus and release authority remain gated on those dependencies and independent review. The follow-up below enables only the existing limited desktop folder-inspection flow.

Focused checks: ten UI/parser regressions passed; Windows PowerShell synthetic inventory regressions passed. A real metadata-only collection returned a partial report with unresolved ancestry, correctly preserving uncertainty. No USB files or volumes were accessed and no device configuration was changed. The unchanged complete tools/verify.ps1 finished with All available T01 checks passed on Windows GNU Rust 1.98.1. Browser visual verification remains pending: the available browser automation kernel exited on both startup attempts. The linked PR records the exact head.

Remaining acceptance: independent review, visual desktop journey, reviewed selected-folder scanner integration, recoverable-lab HID enforcement and hardware release gates. This increment does not satisfy the complete USB protection feature.

## Selected-folder integration follow-up

Owned UI reuses the existing ScanView, native folder selector and shared job cancellation/results when its desktop adapter is connected. It does not send caller-provided paths or snapshot identifiers to native code, create a competing scanner, verify a mounted folder's USB identity, bind a report to a connection, grant storage access or enable HID. The shared job may originate in Scan & Detect; this is stated explicitly.

Thirteen focused UI/parser regressions pass, including native selector method/arguments, missing adapter, shared running-job cancellation and selector failure. Complete unchanged tools/verify.ps1 passed again. No selected real USB contents were inspected, no privileged device changes were made and no hardware blocking was tested. Native installed journeys remain pending; mocked UI regressions are not native authority acceptance.

The main ClamAV adapter permits only checked-in known harmless bytes. Arbitrary files receive bounded byte evidence, not completed malware inspection. Production scanner/native integration remains reserved to Engineer A, requested in issue9#6099478520. USB gate/recovery foundation ownership/handoff is requested in issue12#6099478234. A recoverable Windows physical lab and benign programmable HID fixture are required before enabling or claiming pre-input prevention. The requested ready-to-ship feature is not delivered by this increment.
## Main dashboard USB entry

Owner requests USB/BadUSB/payload prevention and a virtual test before approval. Main Console now includes a USB Guard capability card with a working route action. Storage inspection, HID pre-input prevention, isolated execution and monitoring are separate. A connected demo adapter enables only the existing selected-folder inspection journey, never a prevention claim. USB Guard explains that virtual file execution cannot capture host HID input or certify delayed device behavior. No automatic storage/HID release or isolated execution service is invented. Main module list no longer promises auto-scan on arrival.

Claim issue11comment6101987348; B-owned App callback/Dashboard presentation/USB feature files only. ScanView/generated/native adapter remain A-owned. Meaningful card regression checks disconnected-to-connected transitions, navigation callback and persistent input/sandbox gaps. All26 UI/parser tests and UI typecheck/build pass. Full unchanged verifier scheduled after native USB gate check releases shared cargo target. Installed browser/native/hardware acceptance remains pending. User confirms no spare recoverable test machine; live HID tests/activation remain disabled. No policy change, USB payload execution, E: access or Defender change.
