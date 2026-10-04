# Navigation hold evidence — 4 October 2026

Issue #14 internal lifecycle increment. Tests initially failed for missing module. A later behavior regression reproduced an inspection downgrade from potentially_harmful to unknown on replay; sealed completion fixes it. Five focused tests pass after correction. No real DNR interception, remote fetch, UI, desktop bridge, vault or WhatsApp acceptance is claimed.

See docs/handoffs/navigation-hold.md for signatures, monotonic time, forged/stale rejection, bounded-owner obligations and required user-gesture/policy authority. Scope expansion is PR47; this increment implements only a prerequisite.

Full tools/verify.ps1 passes: workspace lint/tests, TS generation parity/typecheck/tests, UI builds and extension tests/build/smoke. Package test discovery includes the five new tests. node --check on the new module also passes. Automated evidence only; no manual browser interception claimed.

Registry follow-up: five more acceptance tests initially fail for missing module; implemented bounded one-current-per-tab registry and all ten navigation tests pass. 32-tab admission rejects overflow without eviction; clearing releases a slot; fresh IDs and invalidation reject replacement/replay/foreign snapshots; invalid replacement leaves current hold intact. New module syntax and full tools/verify.ps1 pass. These are synthetic lifecycle checks, not throughput, DNR interception or durable restart evidence. Initial PR48 a179e2e both CI checks succeeded; new-head CI must be checked separately.
