# USB Guard observation increment

Issue: #11, with #12 runtime coordination. Base: `459afbf332a504442dd789bf0be981432fc8ae6a`. Branch: `codex/engineer-b/issue-11-usb-guard`. Reviewer: Engineer A; integration: coordinator.

Adds a desktop USB Guard route, bounded local inventory import and a read-only Windows PnP collector. Risk, coverage, freshness and operating mode are separate. Composite storage/HID exposure, unresolved ancestry, network exposure, empty observations and stale/partial/unavailable reports remain explicit. There is no assertion of malware detection or BadUSB prevention.

Native scanner adapters and generated contracts remain Engineer A's claim. No privileged authority, scanner implementation, vault, quarantine, device policy or generated contract is changed. Scan and HID permission actions remain disabled pending those dependencies and independent review.

Focused checks: ten UI/parser regressions passed; Windows PowerShell synthetic inventory regressions passed. A real metadata-only collection returned a partial report with unresolved ancestry, correctly preserving uncertainty. No USB files or volumes were accessed and no device configuration was changed. The unchanged complete tools/verify.ps1 finished with All available T01 checks passed on Windows GNU Rust 1.98.1. Browser visual verification remains pending: the available browser automation kernel exited on both startup attempts. The linked PR records the exact head.

Remaining acceptance: independent review, visual desktop journey, reviewed selected-folder scanner integration, recoverable-lab HID enforcement and hardware release gates. This increment does not satisfy the complete USB protection feature.
