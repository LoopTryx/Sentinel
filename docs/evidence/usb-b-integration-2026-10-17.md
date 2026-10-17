# Engineer A/B USB integration — 17 October 2026

Owner requested combining all progress with Engineer B, compilation and Git publication. Merge parents are A checkpoint `85031d0` and B `3637eb2` (`prattyush-changes-for-v3`, 48 commits since the common base). B commit history and attribution are retained; B branch is never edited or pushed. `apps/desktop/NativeConsole.cs` remains unrelated, untracked and excluded. Integration stays on A PR74 branch for peer/coordinator review, not main code deployment.

## Combined behavior

B's latest navigation, typography, glass surfaces, sounds/mute safeguards, page refresh, scan alerts and extension changes are retained. USB Guard remains inside the existing console with native prompt-free discovery, session-bound device references, confirmation dialogs, existing Windows Hello and selected-device recovery. The only merge conflict was `usb-guard.css`: B's shared/rem typography rules were retained with A's inline actions and dialog rules.

The dangerous old shared-class ApplySelection stays centrally disabled. The persistent exact-block worker and baseline sources are preserved but unqualified production activation is not enabled. New runtime preserves hashes/manifests, suspended named-job workers and independent recovery. Actual private SYSTEM rollback passed; real authenticated live baseline was verified read-only. Full backend private test failed on parent SYSTEM-owner job creation (Win321307); elevated probe proved default administrator ownership works. Corrected source is built; corrected full private execution is still pending. No physical blocking/restart acceptance is claimed.

## Verification

- Unchanged `tools/verify.ps1`: PASS, `artifacts/usb-b-integration-verify.log`; Rust formatting/strict lint/workspace tests, generated bindings, TypeScript typecheck, UI25files55tests/build, extension/runtime tests/build/smoke included.
- Combined desktop: full `apps/desktop/build-console.ps1` inputs compiled to isolated `artifacts/combined-console-20261017` using official SDK at `artifacts/ducky-webview-sdk`. Original output was locked by the running app; a generated local copy of the same build script changed only its output directory. `artifacts/usb-b-integration-console.log` records all native builds including recovery DLL. The running installed app is not replaced.
- `tools/build-usb-admission-operator.ps1`: PASS default gated build. It explicitly reports live device policy compile-disabled. No install/tasks/device operation.
- Exact state/transaction/native authority, GPO/overlay and scheduler contract checks pass; private worker/qualifier builds pass. These do not prove real device behavior.
- Combined complete portable package created with existing packaging script, then freshly compiled desktop binaries overlaid. Every packaged file's SHA256 verified. Existing packaged `tools/launch-demo.ps1 -Smoke` exited0; graceful runtime shutdown removed ephemeral connection config. No password/device-policy action performed.

The earlier antivirus E0463/missing-rlib error disappeared on no-run recompilation in the same isolated directory. Both subsequent unchanged full verifiers passed without unrelated source edits; the original failure cause remains unestablished.

## Continuation

Read `docs/usb-progress-handoff-2026-10-17.md` and `docs/work/usb-persistent/`. Rerun the corrected actual private backend against its authenticated existing manifest; do not overwrite pending state or rebuild the immutable installed worker blindly. Finish exact production connection, owner Hello, safe Allow/recovery and controlled physical/reboot tests before enabling capability. Automatic unknown-device holding stays inactive pending a verified safe mechanism. No self-merge or issue closure.
