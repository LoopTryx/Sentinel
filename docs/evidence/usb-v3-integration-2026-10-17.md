# USB Guard adoption into the owner v3 build — 17 October 2026

Owner request: adopt Engineer A USB Guard while preserving the current v3 UI. Integration parent: Engineer B `3637eb2`; Engineer A source: PR74 `0d8509e65b4bdab3c550e6ad023d617ec56e5c6a`. This branch integration does not merge main, release software, install a privileged operator or activate device policy.

## Preserved and adopted

The source merge retains B's background palettes/recovery, full-width transparent header, natural-flow ribbon, glass cards, geometric typography, sidebar, quick actions, sound controls, refresh and browser extension. The only text conflict was USB CSS; kept B's readable sizes and added A's inline/dialog selectors. USB view receives A's prompt-free native device discovery, opaque references, confirmation, stale inventory/refusal handling and native IPC. B's Input activity panel remains below the new list. USB rows use the existing USB icon and v3 glass; dialog controls retain keyboard focus and 44px targets. Scan is disabled because the contract explicitly supplies canScan:false. Block remains disabled by both contract and native containment gate. Allow requests retain native confirmation/elevation/Hello and installed-operator requirements; this integration did not exercise them.

All PR74 source progress is included as ancestry, including dormant exact-block/recovery candidates. Presence in this branch is not activation, independent security approval or hardware acceptance. No registry/policy apply, task registration, live device restart, installer or E: access was performed.

## Verification

- Complete unchanged tools/verify.ps1: PASS, including Rust formatting, workspace Clippy/tests, generated contracts, TypeScript checks, 25 UI files/55 tests, build, extension/runtime tests and extension smoke.
- Native desktop build-console.ps1: PASS using the previously bundled official WebView2 SDK libraries. Builds recovery-only USB DLL; no installation or policy activation.
- Clean-process native console smoke PASS: navigation, glass presentation, Console heading and inspection bridge; log usb-v3-console-smoke-final.log.
- Six native checks PASS: tab model, strict framing/identity, actual local subprocess IPC, device action states, selected-device recovery refusal and exact restart selection. These are pure/local fixtures, not physical device tests.
- USB unit test isolates the already separately tested Input activity child; added assertions that unsupported Block and Scan remain disabled. First combined run exposed a mock-response ordering issue, corrected without changing production state handling.
- Logs remain local at D:/SENTINAL/usb-v3-integration-verify.log, usb-v3-native-build.log and usb-v3-native-checks.log.

PR74 hosted run38976618256 is still failed: nine sentinel-av tests report private-storage-policy/action failures on its Windows runner. This differs from the earlier handoff's local E0463 compilation failure; the cause of that runner discrepancy is not established here. No antivirus guard/test/verifier was weakened. A new hosted result for this integration is separate from the passing local evidence.

## Outstanding

Independent integration/security review; installed native operator version/identity acceptance; owner-driven external-device discovery/Hello/recovery journeys. Persistent exact-device blocking still requires the production worker, authenticated independent SYSTEM/boot recovery, preservation/late-writer proofs and restart/device acceptance described by A. Do not label general HID blocking or a USB payload sandbox complete.
