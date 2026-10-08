# Shared Sentinel collaboration rules

Owner amendment: 8 October 2026. GLM is replaced by GPT-6.1-sol. Both engineers may implement UI and logic. Stable identities: **Engineer A (existing Codex)** and **Engineer B (replacement GPT, former GLM lane)**. Coordinator owns issue triage, integration and branch retirement. This supersedes older exclusive model-based assignments; product requirements and release gates remain unchanged.

## Context and issue ownership

Read AGENTS.md, docs/Sentinel-Master-Plan.md including section 19, docs/phase-1-70-30.md, STATUS.md, chat.md and current scope amendments. Prompts: [Engineer A](agent-prompts/Codex-Logic.md), [Engineer B](agent-prompts/GPT-Peer.md). Fetch main and inspect issues/PRs/reviews before selecting work. Historical documents are not current capability or ownership evidence.

A leads runtime/security architecture and foundations. B leads UI/design/awareness and owns assigned complete features including backend logic, adapters and tests. Neither lane is exclusive. Existing claims remain reserved until accepted transfer. Replacement B records takeover of GLM's work and verifies no active peer edits before updating the legacy lane. Do not overwrite peer branches or unpublished files.

Claim one ready issue with identity, objective, branch, base SHA, exact files, dependencies, contract changes, acceptance and reviewer. New branches: codex/engineer-a/issue-<number>-<topic> or codex/engineer-b/issue-<number>-<topic>. Preserve legacy names/history. Confirm the claim is uncontested before edits. Overlapping claims/files require an acknowledged handoff or coordinator arbitration; silence is not approval. While awaiting review, select independent unclaimed work.

Shared contracts, IPC/native host, vault authority, quarantine/restore, permissions, privileged actions, security decisions and shared dependencies/verifier files require an agreed editing owner and independent peer review before integration. Either engineer may implement them. Record caller/callee types, authorization, bounds, cancellation, error states, redaction and compatible migration before cross-boundary edits. Generate bindings from sources; never hand-edit generated contracts. Separate independent changes and security fixes from presentation polish.

## Delivery and independent review

Use isolated issue checkouts from current main or a documented reviewed stacked base. Preserve dirty/unpublished work. Implement small buildable increments with meaningful behavior/failure regressions. Run focused checks and tools/verify.ps1 plus applicable native-preview smoke/jobs checks. Record exact head, commands, results and unexecuted acceptance. Failed/skipped/blocked stages remain visible. Fixtures do not prove installed browser behavior, worker containment or hardware protection.

Push the owned branch, open a linked PR and request the named peer's review. Each engineer reviews correctness, privacy, contracts, failure behavior and user journeys regardless of model/author. Security-critical changes require substantive independent authority/failure-path review. Coordinator integrates only after required review, CI and applicable acceptance gates; self-review is not peer approval. Resolve comments with evidence. Do not merge, retire branches or tag releases unless explicitly assigned that coordinator action. main remains the sole integration source. Never force-push. Retire only fully integrated branches with recoverable history and resolved active dependencies.

## Communication protocol

Issues/PRs are the durable record. chat.md is a lightweight coordination channel on main. Append small dated messages after fetching main; preserve peer messages and use fast-forward-only pushes. If main advances, fetch and reapply only your addition. Code stays on issue branches.

Message format: UTC timestamp | Engineer A/B/coordinator | issue/PR | CLAIM/HANDOFF/CONTRACT/REVIEW/BLOCKED/RESOLVED | exact head | concrete decision/question | evidence | requested reply/next action. Answer direct technical requests at the next session start before dependent edits. Handoffs name files, revision, current behavior, remaining checks and accepting engineer. Contract discussions end in issue/PR decisions. Avoid repetitive status messages. Never claim delivery without publication. If unavailable, prepare an explicitly undelivered owner relay and continue independent work. Cross-chat tool messages need user authorization for the destination; repository-channel authorization is not automatic cross-chat authorization.

## Autonomy, safety and truthful claims

Continue ready authorized work and document routine choices. If one dependency blocks work, select another ready claim. Ask the owner only for essential access/hardware, an irreducible product choice or consequential work outside scope. If all ready work is blocked, state the exact prerequisite and stop honestly. No promise of endless/background execution.

Keep Defender enabled. No live malware/EICAR files, USB/HID blocking on the daily-use machine or E: access except expressly selected harmless read-only observations. No secrets/passwords/raw chats/file contents in AI, logs or published evidence. Use synthetic credentials until vault review permits valuable ones. Unknown, unavailable, partial, stale, failed, disabled and fixture states remain distinct. Empty history or a successful connection never implies active protection. USB storage inspection does not prove HID/firmware safety. All privacy, real-device evidence, milestone and release gates remain binding.
