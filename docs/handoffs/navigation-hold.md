# Native extension navigation hold lifecycle — issue #14

Module apps/extension/src/navigation-hold.js is pure internal logic, not a live browser block/redirect. No permissions, DNR rules, fetching, popup or desktop transport enabled. GLM integrates after review and a registered host adapter exists.

Signatures: createNavigationHold({tabId,navigationId,assessmentId}, now, ttlMs) returns frozen snapshot; finishInspection(snapshot, sameSubject, reason, now) returns current snapshot; consumeContinuation(snapshot, sameSubject, now) returns next snapshot or null; invalidateHold(snapshot) returns current snapshot. Reasons accepted: unknown or potentially_harmful. State: held, continued_once, expired, invalidated. Coverage always partial, never safe. Initial reason inspection_required.

Use trusted extension tab/document events to allocate fresh process-local IDs, not page supplied identity. References are ASCII alphanumeric/_/- 1–64 chars; tab is nonnegative safe integer. now is a nonnegative safe integer monotonic tick (for example floored performance.now); ttl 1–300000ms. Reject invalid input with fixed TypeError. Clock regression/nonfinite/expiry seals state. Wall clock is unsuitable; restart must discard all sessions and invalidate old responses.

Example: hold=createNavigationHold({tabId:7,navigationId:'nav-1',assessmentId:'assessment-1'},100,500); hold=finishInspection(hold,hold.subject,'potentially_harmful',110). Render actual reason and partial coverage. Replace local handle with returned current snapshot; do not retain history. JSON contains only copied correlation fields/state/reason/coverage, no target URL/content. This is not an authoritative Rust DTO or request decoder.

Native owner WeakMap makes forged/JSON-copied/stale snapshots unusable for continuation. One inspection completion seals against replay/downgrade. Terminal states cannot be reopened. Different tab/navigation/assessment rejects stale results. Old results return current state; never render an old caller-held snapshot as authoritative. A null continuation is rejection, not allow. Adapter must own a bounded active-tab map and invalidate/release snapshots on navigation/tab close; WeakMap alone is not a global admission bound.

consumeContinuation is only lifecycle consumption AFTER authenticated user gesture and policy checks; it grants no browser allow itself. Host must bind actual target privately to same navigation, validate continuation policy, then perform exactly scoped navigation/rule operation. Do not expose arbitrary calls to content scripts or infer user consent from snapshot possession. An expired hold must remain blocked/unknown until explicit new inspection; null does not install allow rules.

Acceptance: node --test apps/extension/test/navigation-hold.test.mjs. Five tests cover subject binding, replay (including original snapshot), forged snapshot, inspection downgrade, terminal sealing, monotonic expiry, bounds, fixed path-free output. These synthetic state tests are not real browser interception, shortener resolution, popup or desktop event evidence. Full verifier recorded in PR.

Next integration: reviewed bounded native bridge/events, DNR hold/rule mapping and target/navigation binding, popup/desktop outbox, actual owned benign Chrome interception. Remote hostile fetching, valuable vault credentials and cloud content remain gated separately.
