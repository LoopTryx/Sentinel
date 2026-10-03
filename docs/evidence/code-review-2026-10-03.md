# Sentinel code review — 3 October 2026

Schedule: ACTIVE thread heartbeat `sentinel-code-review-every-4-hours`, every four hours. Review scope: all first-party source/configuration on main 9f444bd43067b6bb9c168146d25ae85fb3a1e768 and the published runtime candidates below. Review only; no fixes or merges. Current school-showcase amendment in PR #22 was read to separate immediate scope from the later protected-product roadmap. The existing hourly engineer automation was left unchanged.

## Findings and durable records

1. **P2 — Recovery journal loses acknowledged leases under concurrent writers.** [#23](https://github.com/LoopTryx/Sentinel/issues/23). `crates/sentinel-recovery/src/journal.rs:48-54`. Two Journal instances opened at the same EOF both accept begin; the second overwrites the first equal-length record. Isolated Rust reproduction expected two active leases after reopen and failed with one. Both begin calls succeeded. Require exclusive writer ownership before replay/truncation. Current implementation is fixture-only; no installed privileged vulnerability is claimed.
2. **P2 — Future snapshot is treated as current after clock rollback.** [#24](https://github.com/LoopTryx/Sentinel/issues/24). `crates/sentinel-intel/src/cache.rs:131-136`. Direct-library proof: retrievedAt=100, expiresAt=160, lookup now=50 returns Listed. Define a conservative noncurrent/clock-anomaly state. No system clock or network was changed for the proof.
3. **P2 — Cache history and startup work are unbounded.** [#25](https://github.com/LoopTryx/Sentinel/issues/25). `crates/sentinel-intel/src/cache.rs:45-63,83-108`. Twenty successful imports retain forty JSON/ready files; Cache::open revalidates each historical marker. Bound generations/bytes and preserve validated rollback candidates. This review did not measure production latency or claim a current crash.
4. **Concrete P2 draft gap within existing #9.** [Issue comment](https://github.com/LoopTryx/Sentinel/issues/9#issuecomment-5965915626), [PR #18 comment](https://github.com/LoopTryx/Sentinel/pull/18#issuecomment-5965915766). At 95591a1, `apps/desktop/ScanJob.ps1:112-122` accepts complete=true, cancelled=true, limitReached=true and impossible directory counters. The actual published function was executed in memory and accepted the report unchanged. `Sentinel.ps1:146` can display Traversal finished: True. Preserve legitimate partial results while rejecting cancellation/limit completion contradictions. This remains a draft gap, not a new main security issue or duplicate feature ticket.

All findings are assigned to Codex logic ownership in their records. Generic fixture/live-IPC/worker-containment/host/vault gaps remain their existing issues and are not new defects. Known main output/cleanup findings are already addressed by pending #17/#21, so no duplicate issues were opened.

## Coverage

- Agent jobs and transports, actual Windows authorization and pipe server/client, durable storage and lifecycle dispatcher, protocol DTOs/native codec and generated bindings.
- Scanner traversal/hash/test-string/worker host/worker executable, Windows resource and inherited-handle boundaries, core config/privacy/errors, CLI callsites and cancellation/report paths.
- Entire React UI/localization/styles/entrypoints/configuration, extension worker/status/popup/manifest/rules, build and parity scripts, desktop process helpers/presentation/report validators.
- Recovery journal/executable, offline intel parser/cache/providers/callsites, package/workspace and CI/verifier configuration. Relevant tests were inspected across these boundaries.

Published candidates reviewed: durable jobs 0d28de241c3843ac782ddaff8859d1b67f5414ce (#19), native contract 878b1b3d3ad9010888e4abcd57d7704c5e901a5e (#20), worker resources/output f89930882dc2923e044f3eeebeaa646180d3abee (#17), desktop output/shutdown 741738473bae6e7974ca67a66175d6ff33cabdd9 (#21), draft report handoff 95591a1195d912e5cdab764aba037dedc320e10b (#18), school-showcase proposal b2d8475b97daac291385f993c7f7c59589273612 (#22). Findings bind to these exact revisions; newer work requires another review.

## Actual checks and limitations

- Full tools/verify.ps1 in detached main checkout: exit 0; formatting/Clippy/Rust tests and generated bindings, TypeScript typecheck/tests/build, extension syntax, all 32 extension tests, build/parity smoke passed.
- Native desktop window smoke and real benign CLI process-job tests in detached main checkout: exit 0; title/handle/fixture state plus running/completion/failure/cancellation/timeout/argument handling.
- Isolated published durable candidate: agent 14, service 24, proto 23 tests passed. Native candidate: five framing tests passed. All 16 regenerated TypeScript binding object hashes matched committed bindings.
- Existing recovery suite: six tests passed. Custom two-writer recovery test failed as expected (observed one retained lease, expected two). Cache future-time and twenty-import retention proofs confirmed the observed current behavior. Reproduction code was temporary and not added to production/test sources.
- Extension reviewer independently ran 32 tests and UI TypeScript checks and confirmed tested source hashes. Worker/resource and shutdown candidate conclusions beyond the listed checks are source/callsite/test review, not a new full branch-verifier claim.

No manual Chrome/live-site interaction, NVDA/reflow rehearsal, hardware USB/HID test, vault review, end-to-end school rehearsal or production benchmark was claimed. Defender stayed enabled; CRYPTIC (E:) untouched; no policy changes, real credentials, malware or EICAR files. Contributor checkouts/indexes/branches and unpublished files were not edited. No additional high-confidence reachable defect was found in the reviewed auth/native/UI/extension paths; this is not a security certification or proof of zero defects.

Next review: verify fixes for #23-#25, directory validator corrections, and any new published logic/UI integration. Keep the immediate showcase scope proportionate while preserving later safety gates.