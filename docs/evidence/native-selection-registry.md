# Native selection registry evidence

Issue #9; branch codex/issue-9-selection-registry, based on PR36 head 76462e7. No presentation or peer branch changes. No external dependency or generated DTO changes.

Initial test command failed with unresolved sentinel_scan::selection before implementation. Three new checks then pass, including an actual temporary harmless file scan and report privacy check; existing scan control/progress/report/pipeline/lib checks pass. Paths are retained only in native memory and omitted from Debug/typed report output. Missing/replaced/wrong-registry references do not resolve. Failed registration clears previous picker intent.

Verifier Rust formatting/lint/workspace tests passed. The first run stopped at pnpm dependency access; pinned frozen-lockfile restoration reused the local cache with zero downloads or version changes. Remaining TS typecheck, six UI tests, build, 32 extension checks, extension build/smoke and generated parity then passed. This is a registry prerequisite, not native picker/dispatch, stable identity, sandbox, installed agent, UI journey or rehearsal evidence. E: and device policies were untouched.
