# Release consolidation findings

- Current source checkout: .local-handoff/main-scan-integration; branch codex/engineer-a/sentinelai-nim, HEAD 0bc3206.
- Outer db54 checkout is older and must not replace this source.
- Integration checkout has approximately 190 changed/untracked source paths since the v3 integration commit.
- Remote advertises main 92ab2a6 and historical tags v1.0.0, v2.0.0, v3.0.0.
- Latest local single installer is labeled v6.0.0. It predates final console/email changes; cannot publish it unchanged as current.
- README still describes the early dummy-account portable demo and needs replacement with current, qualified capability descriptions.
- GitHub CLI is not on PATH; Git HTTPS access works. Inspect authenticated API access without exposing credentials.

- GitHub has published v1/v2 releases plus a v3 draft and two older extension-only drafts. Main differs from integration only in coordination history, now merged.
- Existing v6 installer privacy/hash audit passed for 478 entries. It remains a prior-asset source, not a current source-matched release.
- Native manifest must match the exact shipped worker; rebuild scanner/host together to avoid the previous startup-integrity mismatch.
