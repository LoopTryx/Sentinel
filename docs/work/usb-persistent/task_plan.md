# Persistent exact-device blocking work plan

Owner request 16 October: enable real Block and retain explicit blocks across Windows restarts. Preserve the now-working ordinary controls. This supersedes the old five-minute expiry for successfully committed explicit blocks, not recovery of interrupted mutations.

- [x] Define versioned exact-interface deny policy and committed-vs-pending durable state. Keep it distinct from SNTINP03 global deny and its leased journal.
- [in progress] Implement and test candidate durable transactions and narrow saved/effective Windows provider; no unrelated policy edits or implicit device approvals.
- [ ] Review authority, coexistence with authenticated retired legacy baseline, recovery, startup and installer migration. Keep source contracts authoritative.
- [ ] Qualify actual native provider using private GPO test path and synthetic subjects, including interruption/reboot-state recovery and preservation of committed blocks.
- [ ] Connect Block/Allow popups to qualified protected provider, preserving Hello and prompt-free browsing.
- [ ] Owner-operated selected harmless device block/reconnect, allow/reconnect, and actual Windows restart persistence/release tests. Never infer reboot or input flow from fixture tests.
- [ ] Commit/push tested owned changes and update PR74 evidence; coordinator-reviewed integration remains separate.

Guardrails: no class-wide apply from a device button; no blanket timeout removal; exact external USB HID subjects only; built-in safety candidates cannot enter deny set; CRYPTIC E untouched, Defender enabled; no force override/reboot; foreign-policy drift refuses mutation. Existing installed containment build remains until the new provider is qualified.

## Current continuation (17 October, qualified backend)

Private full backend and read-only production bridge now PASS; see progress.md for exact evidence and unknown historical COM root cause. Native Block/Allow integration is compiled behind explicit ReviewedExact, original shared-class gate remains false. Await owner tray Exit to replace locked installed console, then RP2040 physical acceptance. No live input/restart acceptance yet. Preserve B and unrelated audio changes.
