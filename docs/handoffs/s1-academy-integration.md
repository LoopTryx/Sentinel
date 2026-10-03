# S1 Academy integration map

2026-10-03, issue #14. GLM owns presentation, Codex local logic, coordinator reviewed integration. Published leaf APIs are available on candidate branches; none is currently a registered desktop command.

| Journey / PR / head | sentinel_intel functions | Result / error | Actual CLI |
|---|---|---|---|
| URL X-Ray #26 / 6dcce44 | url_explanation::explain_url(&str) | UrlExplanation / UrlExplanationError | url explain-local <invented-url> |
| Phishing #30 / 9e02a7f | phishing::phishing_scenarios(); evaluate_phishing(id, choice) | PhishingScenario, PhishingFeedback / PhishingError | academy phishing list; academy phishing evaluate <id> <choice> |
| USB #32 / b8ea1f2 | usb_lesson::usb_lesson_scenarios(); evaluate_usb_lesson(id, scope) | UsbLessonScenario, UsbLessonFeedback / UsbLessonError | academy usb list; academy usb evaluate <id> <scope> |
| Password #33 / c23ace2 | password_autopsy::evaluate_password_lesson(id, choice) | PasswordAutopsy / Rust PasswordLessonError | academy password-autopsy <id> <choice> |

Read each candidate's docs/handoffs/{url-xray,phishing-dojo,usb-autopsy,password-autopsy}.md for signatures, generated DTOs, request/response examples, limits and errors. Sources belong to sentinel_proto; regenerate bindings, never hand-edit them. Password has no list endpoint: IDs predictable/reused/unique_generated and choices replace_predictable/make_unique/keep_unique are closed. Never supply real credentials or a password textbox value.

## Unified implementation sequence

1. Coordinator integrates reviewed scope #22 and leaf PRs, serializing proto/intel exports, the single internal dependency, CLI arms/help, generated files and STATUS. Preserve all four CLI commands; do not replace a shared file with one candidate's version.
2. Codex supplies a reviewed local adapter after consolidation or on an explicitly identified integration candidate. Preserve actual DTO/errors; PasswordLessonError needs a fixed serialized adapter error. No Tauri/IPC/native command is registered by these leaves. #19 still has scanAvailable=false; #20 browser v1 only capabilities.list/url.assess. Do not silently broaden privileged/browser dispatch for lessons.
3. GLM wires the adapter on a presentation branch. Missing adapter is unavailable feedback, never synthetic success reported as live connection. Owner's earlier-UI recovery is separate; unchanged #31 (8803ac4) still needs the published freshness/focus corrections. This map does not approve its visual design.
4. Leaves are immediate bounded synchronous operations, with no scan progress/cancel endpoint. Async wrappers should disable duplicate submit, bind results to current subject/request, discard replies after navigation and show wrapper failures as unavailable. Avoid artificial scan timing. Optional clearable learning storage keeps IDs/completion only; no raw URL/message/password, no global protection state. Correct=false is feedback, not completion.
5. Selected-file scans remain separate #6/#9/#11 integration with genuine scope/count/progress/terminal states. Educational DTOs cannot certify devices, accounts or real messages.

## Acceptance on a single integration SHA

- All leaf tests, full verifier and all four CLI demos pass after shared-file merging.
- UI matrix: Phishing three scenarios x three choices; USB three x four; Password three x three. Wrong answers permit retry and never mark completion. Synthetic labels/limitations remain visible.
- URL: reserved destination, misleading userinfo, internationalized host, HTTP IP, invalid/oversized input. Full ASCII destination and partial/low semantics remain visible; no auto-open/fetch or safety claim.
- Missing adapter, rejected enum/ID, duplicate submit and navigate-before-reply do not display another subject's result. Verify keyboard choices, feedback announcement, retry/next and focus restoration in the actual app.
- Verify clearable local completion without raw input persistence and deterministic repeated visitors. No E: interaction or real credentials.
- Record actual GUI build SHA/launcher and operator evidence. Ten route rehearsals (three fresh, two offline), pinned build, offline pack and fallback recording remain pending.

Next prerequisite: reviewed leaf consolidation plus explicit adapter ownership, then GLM wiring. PR33 technical review found no blocker in the closed synthetic leaf, with five existing tests, full verifier and an independent process probe passing; see docs/evidence/password-autopsy-review.md. This handoff is not evidence of completed interactive journeys.