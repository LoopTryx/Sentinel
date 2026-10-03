# Phishing Dojo verification — 2026-10-03

Issue #14 educational S1 leaf, isolated `codex/issue-14-phishing-dojo` from main `80af890`; initial implementation commit `7383e7c`. Primary dirty desktop/report checkout and GLM UI branch remain untouched.

## Observed checks

- First new-library compile failed because the proposed module/dependency did not exist. After adding DTOs and empty API stubs, all five library behavior tests failed (zero scenarios; UnknownScenario instead of bounded-ID errors/results). After implementation, all five passed.
- Both end-to-end CLI tests failed before CLI wiring (usage exit instead of list/result; wrong error code). After wiring, both passed. Exercises real subprocess JSON listing, all three choices, invalid/absent IDs and unknown choice with no input echo.
- Library test coverage: all nine scenario/choice pairs, synthetic labels, OTP/payment clues, benign counterexample without proof claims, ID/choice rejection, fixed errors, bounded serialized output and fifty deterministic repeated calls.
- `cargo test -p sentinel-proto` passed: 20 generated-binding tests (four new) and seven existing contract tests. Types were generated, not hand-edited.
- `cargo test -p sentinel-intel` passed: five new lesson tests plus five existing cache/provider tests.
- `cargo clippy -p sentinel-intel -p sentinel-cli -p sentinel-proto --all-targets -- -D warnings` passed.

`tools/verify.ps1` completed with exit 0 and All available T01 checks passed: Rust fmt/clippy/workspace tests, generated bindings, TypeScript typecheck/tests, UI build, extension syntax, all 32 harness tests and build/parity smoke. No UI source changed. No live desktop/Chrome interaction, manual rehearsal, network-disconnection rehearsal or event-machine latency claim is made. Tests use synthetic reserved-domain messages and do not perform network operations.

## Limits and review

Static educational lesson only; not a raw-message phishing model or protection Assessment. IDs capped at 64 bytes with ASCII syntax; fixed three-message catalog tested below 8192 serialized bytes; every feedback below 4096 bytes. `correct` represents independent verification as the recommended lesson response; ignoring a suspicious request is described as avoiding action without resolving uncertainty. No learning data is persisted. No external package/version added: only existing internal intel-to-proto edge, also proposed in PR #26.

GLM review: wording, choice meaning, DTOs, labels, feedback and future keyboard integration. Coordinator: preserve other module exports, dependency and CLI commands when integrating overlapping PR #26; integrate only after review/CI. Read `docs/handoffs/phishing-dojo.md` for complete APIs/error/capability semantics, request/response example and acceptance commands. Presentation, reviewed integration and ten-run S1 acceptance remain outstanding.

Board synchronization prerequisite: current Trello connector listed only an unrelated board and search for Sentinel returned no board. No duplicate board created and no original 23-card list altered.
