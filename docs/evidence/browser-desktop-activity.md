# Browser desktop activity evidence — 4 October 2026

Issue #8 prerequisite, codex/issue-8-browser-activity. Three tests initially fail missing APIs; implemented fixed redacted generated event DTOs and bounded native inbox, then all three tests pass. All18 proto/export tests pass. Tests are synthetic native ingest, not actual Chrome/native messaging/UI connectivity.

128-event retention with explicit omissions, latest exact duplicate acknowledgement, conflicting/older replay and foreign session rejection, bounded reference validation. No UI source, permission, native v1 method or service endpoint changes. Full repository validation is recorded after execution in PR.

Handoff browser-desktop-activity.md records desired unified landing surface, actual signatures/example/error semantics, gaps and next native transport/UI integration. Existing unmerged work preserved. No full connectivity or S1 completion claimed.

Full tools/verify.ps1 completed successfully after commit3cad7df: workspace formatting/lint/tests, Rust-generated TS parity, TS typecheck/tests, UI build and extension syntax/tests/build/smoke. Owner explicitly clarified actual shared vault/logging/download-file inspection; this inbox remains prerequisite only.
