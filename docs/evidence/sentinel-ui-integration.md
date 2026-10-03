# Recovered Sentinel console integration

Owner-authorized integration, 3 October 2026. GLM sentinel-ui source `cbca6eb9db911535d5a018f68a183759145fb87c` is imported under apps/ui into main `1bc24b9`. The source branch has unrelated root history; a two-parent integration commit preserves it without replacing main's Rust/extension/docs. Contributor source branches are unchanged.

Visuals retained: navy glass sidebar, uppercase navigation, sticker-chip hero, azure accent, stat tiles, bundled fonts, dither/grain effects and alert-driven console theme. The default mode is explicitly preview/unavailable, with azure rather than a verified-safe green state. Dashboard alert button is a local synthetic illustration; no EICAR file/device/policy operation occurs. Password estimates and message clues are bounded local educational tools with disclosed limitations, not account/message protection.

Required integration corrections:
- Original Tauri commands app_status/scan_path/list_drives/simulate_attack/quarantine/history have no implementation in main. Do not invent a live native API or poll it. Missing scan/quarantine/history integration is displayed explicitly. Existing CLI and WPF scanners remain unchanged and usable through their own documented route. No live monitoring, encrypted vault, full signature engine or destructive remediation claim.
- Unsupported WebGL previously throws from OGL renderer creation. Both decorative effects now retain the surrounding console on setup failure, skip animation for reduced-motion preference and release GPU resources on cleanup.
- Editing a message invalidates its prior result; clues remain bound to the checked subject. Inputs are bounded, passwords start masked, fonts are local, and no message/password is logged, persisted or transmitted by these tools. Password time estimates state their attacker/randomness model and no breach check is claimed.

Verification:
- Initial false-protection guard failed before correction; three DOM regression checks failed first (both null-WebGL renderers and changed message retaining old result), then passed.
- Final six UI tests pass; TypeScript and production build pass. Full tools/verify.ps1 passes (GNU Rust 1.98.1 local toolchain): Rust fmt/lint/tests/generated parity, UI and contracts checks/build, all 32 extension tests and dist parity.
- Independent review confirmed both fixes and reran six UI tests, with no remaining blocking finding in this scope.
- Headless installed Edge: default rendering, local scenario/reset, all six routes, actual check/edit message invalidation, screenshot, no pageerror. Devtools informational/context cleanup messages are not a browser protection test. Screenshot: sentinel-ui-integration.png.

Dependencies: preserve main's pinned React/TypeScript/Vite/workspace packages. Add only source-used ogl 1.0.11, gsap 3.15.0, Tailwind 4.3.3/plugin and jsdom 30.1.1 for DOM tests. Do not import the unrelated npm root manifest/lock, unused Three.js stack or missing Tauri runtime. Existing Rust/contracts/generated/extension/desktop sources are preserved. No actual installed desktop/native dispatch, physical USB, vault security, accessibility certification, offline ten-run rehearsal or protected-product completion is claimed.

Issue #37 tracks this integration. Keep GLM's source branch; superseding UI presentation does not close the broader UI/runtime feature queue or retire another contributor's active work.
