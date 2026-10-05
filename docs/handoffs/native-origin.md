# Native installed-origin validation prerequisite

5 October 2026 · Codex · issue #8 · follow-up in PR #52 on `codex/issue-8-native-pending` (prepared on isolated `codex/issue-8-native-origin`).

Authoritative API: `sentinel_proto::native_origin::NativeOriginAllowlist::new(ids: Vec<String>) -> Result<Self, OriginConfigError>` and `allows(&self, claimed_origin: &str) -> bool`.

Configure one to four explicit installed Chrome extension IDs from trusted reviewed installation configuration. Each ID must be exactly 32 ASCII lowercase `a` through `p` bytes. Empty, over-capacity, malformed or duplicate configuration fails entirely (`Empty`, `TooMany`, `InvalidId`, `DuplicateId`). No wildcard, fallback, partial acceptance, decoding, case conversion or origin derivation from untrusted caller data is permitted. IDs are not privileged capabilities. Debug reports only the count; errors never echo submitted values.

Example with synthetic IDs:

```rust
let origins = NativeOriginAllowlist::new(vec!["a".repeat(32)])?;
assert!(origins.allows(&format!("chrome-extension://{}/", "a".repeat(32))));
assert!(!origins.allows("https://example.test/"));
```

`allows` accepts only byte-exact `chrome-extension://ID/` for an explicitly configured ID. Foreign IDs, uppercase forms, missing/extra slashes, credentials, ports, query/fragment/path suffixes, trailing dots, encoded IDs, Unicode lookalikes, controls, whitespace and oversized inputs fail. Checking rejects noncanonical length first and compares at most four fixed-size strings.

Host wiring order: trusted installed configuration -> check Chrome-supplied origin argument before reading/admitting a request -> establish actual per-user OS/SID/session authority -> raw bounded framing/strict envelope validation -> session pending lifecycle -> reviewed allowlisted dispatch. Do not construct configuration from an argv origin, JSON claimed identity or page messages. A malicious local process can forge argv; this check alone is not browser process authentication, Windows token/session validation, transport ownership or authorization. A false check means refuse/close ingress without trusted request correlation. No response/pending request or event is created here.

This leaf adds no host executable, registration, extension permission, message bridge or UI capability. GLM keeps connection unavailable. Browser-origin checks, browser sender/tab/frame/gesture checks and authenticated native peer identity are separate required boundaries. Canonical argv shape must still be verified with an actual controlled supported Chrome host launch before enabling the bridge. No installed browser evidence is fabricated by these unit tests.

Evidence: four origin behavior/bounds/privacy tests failed before the module existed, then passed with implementation; five pending-lifecycle, five strict-request and four raw-stream regressions also passed (18 targeted checks), plus proto clippy with warnings denied. Reproduce: `cargo test -p sentinel-proto --test native_origin --test native_pending --test native_request --test native_stream`. No generated DTO or wire schema changes.

Source: [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) specifies explicit `allowed_origins` without wildcards and a caller-origin argument; the registered origin examples include the final slash. This implementation intentionally does not interpret strings as authenticated identity.

Next ready work: review this configuration leaf and PR #52, then implement the authenticated native executable/IPC adapter with actual read/write deadlines and controlled browser launch evidence. Expanded S1 vault/download/WhatsApp/provider and event acceptance remain required. Keep the owner-approved glass UI build intact while working on logic branches.

Verification limitation: full verifier Rust workspace formatting/lint/tests passed, then the older branch dependency reconciliation hit unavailable sandbox network/cache. Equivalent remaining TS typecheck/UI1 test/32 extension tests/build/syntax/smoke/parity checks pass using the existing pinned cache with explicit pnpm reconciliation disabled; fresh-install CI is the integration gate. No dependency version or repository verification configuration was changed.
