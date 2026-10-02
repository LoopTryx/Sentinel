# Shared Sentinel collaboration rules

Owner-aligned baseline: 2 October 2026. The owner's latest instruction supersedes the old Codex-desktop/GLM-extension split. **GLM 5.3 owns presentation; Codex owns logic.** The version-control coordinator manages the common master plan, issue queue, integration review and branch retirement.

## Read before selecting work

Read AGENTS.md, docs/Sentinel-Master-Plan.md including section 19, docs/phase-1-70-30.md, STATUS.md, docs/coordination/2026-10-02-integration.md, and your specialized prompt:

- [Codex logic engineer](agent-prompts/Codex-Logic.md)
- [GLM UI engineer](agent-prompts/GLM-UI.md)

The master plan is the single product specification. The phase split defines demonstration checkpoints, not measured engineering percentages or weaker protection gates. Y2K Cyber Console starts during the functional preview; no fixture or read-only observation is installed protection. Keep all full-product requirements tracked.

## Issue and file ownership

Before coding, fetch current main and inspect issues, PRs and chat.md. Claim one ready issue with owner, branch, exact files, dependencies and acceptance checks. Codex uses codex/issue-<number>-<topic>; GLM uses glm/issue-<number>-<topic>. Do not alter or push a peer's active branch. Codex owns contracts, runtime and security/decision logic, including browser background/native host. GLM owns React/desktop/extension presentation, design tokens, localization and awareness interactions. Coordinate mixed extension files and shared tools/dependencies through a recorded handoff. Never hand-edit generated contract bindings.

main is the one authoritative integration branch. Short-lived issue branches are review vehicles, not competing masters. Preserve useful work and history. Obsolete remote branches may be retired by the coordinator only after verified integration, recoverable archive tags and resolution of active work/PR dependencies. Never force-push. The local unification record is not proof that GitHub has been updated.

## Continuous work and review

Implement small buildable increments with meaningful behavior/failure tests. Run relevant checks and tools/verify.ps1; native preview changes also require apps/desktop/tests/smoke.ps1 and jobs.ps1. Record actual evidence, limitations, reproducible demos and status. Push your issue branch and open a linked PR. Cross-review: Codex checks GLM data/action/security correctness; GLM checks Codex contracts, failures and user journeys. Coordinator verifies integration and merges after required CI/review gates; it does not treat its own tests as peer approval.

Continue ready authorized work without repeated owner permission. Choose and document routine engineering decisions. When a peer/backend/lab task blocks one path, complete an independent ready increment. Ask the owner only for necessary missing access/hardware, consequential work outside scope or a genuine product ambiguity. Stop honestly when all ready work is blocked; no promise of endless execution or fabricated success.

## Direct coordination

The owner authorizes direct messages in chat.md on main. Append small dated messages with sender, issue/PR, concrete decision/question, evidence and requested reply. Fetch fresh main, preserve all peer messages and use fast-forward pushes. Code stays on issue branches. Issues/PRs remain the durable decision record. If the shared channel is inaccessible, prepare this relay without pretending it was delivered:

RELAY TO <peer>
From: <agent>
Issue/PR: <links or clearly identified unpublished draft>
Decision or question: <one concrete point>
Evidence: <tests/files/observations>
Requested reply: <specific answer/review>

## Safety and honest claims

Keep Defender enabled. No secret/password/token/message/file contents in AI prompts, logs or published diagnostics. Valuable vault credentials wait for security review. Unknown/unavailable/partial/stale/disabled/failed/fixture states remain distinct. No automatic destructive remediation from a heuristic. USB storage scans do not prove firmware/HID safety. No Windows USB/HID blocking on the daily-use machine. CRYPTIC (E:) remains untouched except explicitly selected read-only observations or harmless scans. Hardware protection claims require owned recoverable lab evidence.