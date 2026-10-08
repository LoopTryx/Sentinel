# Sentinel agent collaboration

Read [the shared collaboration prompt](docs/AI-COLLABORATION.md) before changing code. The private repository is `LoopTryx/Sentinel`. The master requirements are in `docs/Sentinel-Master-Plan.md`; the owner's current milestone split is in `docs/phase-1-70-30.md`.

Two GPT contributors, Engineer A (existing Codex) and Engineer B (GPT-6.1-sol replacing GLM), work through claimed issues and branches. Both may implement UI and logic. Do not edit another active contributor's branch or claimed files without an accepted handoff. Issues, PRs and reviews are the durable technical record.

The owner also authorizes direct coordination in `chat.md` on `main`. Append small messages after fetching current main; preserve peer messages and use only fast-forward pushes. Use the owner relay when this channel is unavailable. Keep code on each contributor's issue branch.

The owner's `CRYPTIC (E:)` USB must remain untouched except for explicitly selected read-only observations or harmless scans. Do not test Windows USB/HID blocking on the daily-use machine. Do not present fixtures as live protection.

Current owner amendment (2026-10-08): Engineer A leads runtime/security; Engineer B leads UI/product integration and owns assigned logic features too. Issue/file claims determine ownership. Shared contracts and security-critical changes require independent peer review. Use docs/agent-prompts/Codex-Logic.md and docs/agent-prompts/GPT-Peer.md. GLM-UI.md is historical. Coordinator owns consolidation, issue triage and retirement of fully integrated branches. main remains the single authoritative integration branch; short-lived issue branches remain the review workflow.
