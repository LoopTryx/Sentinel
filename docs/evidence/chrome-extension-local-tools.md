# Chrome extension local-tools evidence

Date: 2026-10-03. Branch: codex/issue-39-chrome-extension-local-tools.

Installed and exercised the unpacked package in actual Google Chrome 154.0.8037.95, using an isolated temporary profile. Chrome loaded the package through its Extensions.loadUnpacked debugging API; this does not modify the owner's normal Chrome profile. The visible dashboard was left open for the owner.

Passed browser checks:
- Runtime reports the real fixture rule active.
- A synthetic credential-bearing URL reports evil.test as destination without exposing credentials, path or query in results.
- A plain HTTPS test URL remains unknown; editing an input clears the old result.
- Invented urgent payment/password/prize text yields explanatory clues; clearing removes inputs/results.
- Navigation to blocked.sentinel.invalid fails with ERR_BLOCKED_BY_CLIENT while enabled, then ERR_NAME_NOT_RESOLVED while disabled. The rule was restored to active.
- Current-tab inspection from the extension dashboard reports unavailable honestly.
- No uncaught page errors occurred.

Screenshot: chrome-extension-local-tools.png. All 35 extension unit tests passed. Independent code review found no blocking bugs. Full tools/verify.ps1 verification passed (Rust formatting/lint/tests, TS typecheck/tests/build, extension syntax/tests/build/parity).

Limits: Toolbar activeTab gesture is implemented but was not separately automated through Chrome's toolbar. No live-site message automation, vault, download interception, native agent or threat feed exists in this increment. No real credentials, malicious payloads or USB devices were used. URL/message checks do not perform network lookups. The user must load the bundle separately to use it in their regular Chrome profile.


