# Native scan wire evidence — 4 October 2026

Issue #9, codex/issue-9-dispatch-contract stacked on PR45. Output-only generated tagged responses and selection-aware conversion; no UI/endpoint changes.

Before implementation, focused tests failed for missing APIs, then failed behavior with stub InvalidDispatchSnapshot/wrong_operation responses. Final actual dispatch test and four wire tests pass; all 31 proto library/export tests pass. Clippy rejected a large enum initially; boxed snapshot storage preserves JSON and final focused lint passes.

Actual benign dispatch checks file/folder output and wrong-ticket rejection. Synthetic models cover stale references, abandonment, lifecycle flags, maximum u64 precision, hash and detail bounds. These are not GUI, blocked OS-read timeout, isolation or ten-run evidence. Full repository verification must be recorded after execution.

See local-scan-wire.md handoff. Review/integration pending. Next: trusted native adapter/picker/UI wiring and hard cleanup; S1 remains incomplete.
