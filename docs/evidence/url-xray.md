# Local URL X-Ray evidence

Issue #14; branch `codex/issue-14-url-xray`; 2026-10-03.

Six CLI behavior tests were added first. Against the original CLI, the four valid-input tests failed because the command did not exist; the two rejection tests passed through the existing usage-error path. After implementation, all six pass. Six additional library tests pass for byte boundaries, structured errors, canonicalization, IP/private destinations, full-host preservation, and ambiguous characters.

`cargo test -p sentinel-intel -p sentinel-proto -p sentinel-cli` passed, including existing tests and generated TypeScript exports. The implementation uses the existing URL parser and an internal proto dependency, with no new external packages.

`tools/verify.ps1` passed on 2026-10-03: Rust formatting, workspace lint/tests, TypeScript typecheck/tests, UI build, extension syntax/tests/build/parity smoke, and committed generated-binding checks. Manual Chrome and desktop UI integration were not exercised by this logic-only increment.

The function performs local parsing only. It outputs the full canonical host and reason codes, excludes credentials/path/query/fragment, and reports low-confidence partial coverage. No network request, reputation verdict, public-suffix inference, desktop command, browser enforcement, or UI integration is claimed.
