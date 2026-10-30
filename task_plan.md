# Repository and release consolidation - 2026-10-30

Owner request: publish accumulated source, normalize historical versions, make the current release v1.0.0, refresh documentation, and retire obsolete branches safely.

## Phases
1. [complete] Inventory local source, remote main, releases, assets, open pull requests and branches. Preserve existing work.
2. [complete] Define release mapping; audit private/generated files; reconcile integration with main.
3. [complete] Update README, release metadata, changelog, build/release tooling and repository hygiene.
4. [in progress] Verify, review and commit logical increments. Publish integration without rewriting commit history.
5. [pending] Publish verified historical/current releases and archive obsolete integrated branch tips before deletion.
6. [pending] Verify GitHub state and report exact shipped artifacts and remaining limitations.

## Decisions
- Historical v1.0.0 -> v0.1.0; other historical major milestones become corresponding 0.x.0 previews. Current application becomes v1.0.0.
- Preserve original commit dates, authors and ancestry. Do not manufacture development history.
- Never publish actual passwords, conversations, API keys, local pairing tokens, profiles, private diagnostic payloads or caches.
- Do not delete branches with unique unintegrated work or open pull requests.
- Installed/browser/hardware acceptance and passing code tests remain distinct.
