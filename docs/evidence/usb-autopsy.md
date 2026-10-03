# USB Autopsy verification — 2026-10-03

Issue #14 educational S1 leaf, isolated managed worktree and branch `codex/issue-14-usb-autopsy` from main `9c3d254`. Implementation `d249a70`. No primary checkout or GLM UI edits.

## Observed regression checks

- Five new library behavior tests failed against empty catalog/UnknownScenario API stubs. After implementation, five passed.
- Additional keyboard-only evidence regression failed because limitations incorrectly included selected-file-only without the no-file state. Corrected to `no_file_sample` when no file exists; all six library tests pass.
- Two actual CLI process tests failed before wiring (usage exit and wrong error response). After wiring both pass: synthetic listing, composite/keyboard scope examples and fixed private-argument-safe errors.
- Tests cover all 12 scenario/answer pairs, input/firmware limitations, benign invented file evidence not authorizing input, no-file versus selected-file state, 64/65-byte boundary, invalid syntax/non-ASCII/newlines/unknown ID, closed enum rejection, catalog/feedback output bounds and 50 repeat calls.
- `cargo test -p sentinel-proto` passes: 21 binding export tests including five new DTOs, seven existing contracts. TypeScript bindings generated from Rust.
- Focused `cargo clippy -p sentinel-intel -p sentinel-cli -p sentinel-proto --all-targets -- -D warnings` passes.

`tools/verify.ps1` completed with exit 0 and All available T01 checks passed: Rust fmt/clippy/workspace tests, TS generation/parity, TypeScript typecheck/tests, UI build, extension syntax, all 32 harness tests and build/parity smoke.

## Limits and review

Three static educational illustrations only. No attached device enumeration/scan or firmware/HID input testing. `fileSampleChecked` is explicitly illustrative and always paired with synthetic labeling; no Assessment, approval/protection state, policy action or persistent learning record. No raw messages/passwords/real hardware identifiers accepted. No E: access, EICAR files, network/model/Defender or settings changes.

GLM review requested for function/DTO usability, choice wording, labels and UI state guidance in `docs/handoffs/usb-autopsy.md`. Coordinator integrates after review/CI and preserves pending PR #26/#30 exports/internal dependency/CLI commands/STATUS. UI integration, pinned event launcher, manual keyboard/privacy/offline checks and ten actual rehearsals remain pending. This increment does not complete S1 or close broad #14.

Next ready actions: review GLM PR #31 for logic/truthful-state correctness; implement invented-input Password Autopsy after fresh ownership check; reviewed adapter integration for the URL/Phishing/USB leaves. Current Trello connector did not expose Sentinel on the last verified lookup; no board/list changes or duplicate board were made by this increment. Synchronize review evidence when the existing board is accessible, preserving the original rightmost 23-card list.
