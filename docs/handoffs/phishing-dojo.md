# Phishing Dojo — S1 logic handoff

Related issue #14; GLM owns presentation, coordinator reviewed integration. This is an educational leaf, not a live message classifier, mail adapter, native host or protection assessment. No external dependency is added; intel uses the existing internal proto crate (same edge as URL X-Ray PR #26).

## Entry points and generated DTOs

- `sentinel_intel::phishing::phishing_scenarios() -> Vec<PhishingScenario>` returns exactly three static invented messages.
- `sentinel_intel::phishing::evaluate_phishing(id: &str, choice: PhishingChoice) -> Result<PhishingFeedback, PhishingError>` is deterministic, stateless and immediate. No I/O, fetching, persistence or diagnostic output.
- Sources: `crates/sentinel-proto/src/phishing.rs`. Generated types: `packages/contracts/src/generated/Phishing{Scenario,Choice,Feedback,Error}.ts`. Regenerate using `cargo test -p sentinel-proto`; never hand-edit generated types.
- Closed choices: `follow_request`, `verify_separately`, `ignore`. IDs: `otp-request`, `payment-pressure`, `club-reminder`.
- ID validation: 1–64 UTF-8 bytes, ASCII lowercase/digits/hyphen only; other inputs return `invalid_scenario_id`. Valid-format absent ID returns `unknown_scenario`. Errors never echo the input. Unknown choice must be rejected before calling the function; CLI returns `invalid_choice`.

## Reproducible integration adapter

The permanent desktop adapter is not implemented here. GLM can consume these functions via the reviewed future Tauri command wrapper. For current local acceptance, subprocess JSON is available:

```
cargo run -p sentinel-cli -- academy phishing list
cargo run -p sentinel-cli -- academy phishing evaluate otp-request verify_separately
```

Example request at a future wrapper (proposed, not a registered RPC):

```json
{"scenarioId":"otp-request","choice":"verify_separately"}
```

Response includes:

```json
{"scenarioId":"otp-request","selectedChoice":"verify_separately","correct":true,"clueKeys":["secret_request","urgency","unverified_destination"],"explanation":"Static scenario explanation followed by choice feedback.","safeAction":"Do not share the code or follow the message link. Contact the school through an independently known channel.","synthetic":true}
```

The explanation in this example abbreviates the actual static text; use the function output rather than copying this placeholder. Actual output is covered by CLI serialization tests. Library errors are a closed serialized enum; CLI exits 1, stdout empty, stderr one fixed code. Listing and successful evaluation print one JSON document. Invalid CLI arity exits 2 without echoing arguments.

## UI/state contract

1. Label both prompt and feedback **Synthetic training scenario**. Render reserved `.invalid` addresses as text, never clickable navigation. No message text is accepted from the visitor.
2. Ask the visitor to follow the request, verify separately or ignore. `correct` means the recommended lesson response was selected, not that a threat was detected or stopped. Ignoring avoids acting on a suspicious message but does not resolve its authenticity; feedback says so.
3. Show concrete clue keys and the static explanation/safe action. Clues: `secret_request`, `urgency`, `unverified_destination`, `payment_pressure`, `unexpected_reward`. The benign reminder has no clues: lack of flags is not proof of sender identity.
4. Separate learning from risk/coverage and any global shield. This DTO intentionally has no Assessment, risk, confidence, coverage or capability-proven fields. No real action is performed for any choice.
5. Processing is immediate and bounded; no scan progress, percentage, cancellation job or timer is appropriate. If wrapped asynchronously, disable duplicate submit until reply and display wrapper failures as unavailable educational feedback, never a successful answer. Dispose stale view replies locally.
6. Stateless calls support repeated visitors. Optional local learning progress belongs to the UI, records only scenario IDs/completion, can be cleared, and does not contribute to protection state. This implementation does not persist progress.
7. Keyboard: focus the choices, announce feedback, allow retry/next without opening links. GLM integration/focus review is pending.

## Limits and acceptance

IDs are bounded before lookup; catalog is fixed at three messages ≤1024 bytes each; tested serialized catalog <8192 bytes and feedback <4096 bytes. No network, host registration, telemetry, AI, raw visitor messages, USB observations or policy actions occur. This is static curated educational guidance, not statistical phishing detection.

Run `cargo test -p sentinel-intel --test phishing` and `cargo test -p sentinel-cli --test phishing`. Check all nine scenario/choice pairs, benign counterexample, invalid/absent IDs, unknown choices, output labels/bounds and fifty repeated calls. Full verifier evidence is in `docs/evidence/phishing-dojo.md`. GLM must still wire and rehearse the interactive lesson; no UI journey or S1 completion is claimed.
