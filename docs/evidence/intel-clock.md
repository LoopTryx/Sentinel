# Issue #24: intelligence clock rollback

Lookup now returns `clock_anomaly` when the supplied current time precedes snapshot retrieval. There is no tolerance: an observation from the future cannot establish current freshness. Provider, retrieval, and expiry remain unchanged. At retrieval and immediately before expiry the normal listed/not-listed result applies; at expiry it is stale. Missing data remains unavailable, and invalid input remains invalid_url.

The persisted-reopen regression failed before the fix (listed instead of clock_anomaly). The test covers both listed and unlisted destinations, time boundaries, provenance, and invalid input. It passes after the fix without changing the machine clock or making network requests. GLM should show an uncertain clock/freshness state with a suggestion to check the clock; it must not show a current or safe verdict.

Validation on 2026-10-03: all six sentinel-intel tests and tools/verify.ps1 passed (workspace Rust/TypeScript, UI build, extension checks, generated contracts).
