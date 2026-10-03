# USB Autopsy — S1 educational logic handoff

Issue #14 educational leaf. This is a synthetic interface-scope lesson, not USB inventory, device access control, a scan, a firmware test or HID protection. GLM owns presentation; coordinator owns reviewed integration.

## Functions and authoritative contracts

- `sentinel_intel::usb_lesson::usb_lesson_scenarios() -> Vec<UsbLessonScenario>`: fixed catalog of three invented scenarios.
- `sentinel_intel::usb_lesson::evaluate_usb_lesson(id: &str, scope: UsbLessonScope) -> Result<UsbLessonFeedback, UsbLessonError>`: immediate, deterministic, stateless evaluation. No I/O or diagnostic output.
- Authoritative source: `crates/sentinel-proto/src/usb_lesson.rs`. Generated TypeScript: `packages/contracts/src/generated/UsbLesson{Scenario,Feedback,Interface,Scope,Error}.ts`. Regenerate via `cargo test -p sentinel-proto`; never hand-edit bindings.
- IDs: `selected-storage`, `keyboard-only`, `composite-device`. Validation: 1–64 UTF-8 bytes; ASCII lowercase letters/digits/hyphen only. Invalid format/length returns `invalid_scenario_id`; unknown well-formed ID returns `unknown_scenario`. No input echo.
- Closed answer enum: `selected_file_bytes`, `input_behavior`, `firmware_safety`, `nothing_measured`. A future JSON wrapper must reject unknown enum values before evaluation. CLI returns fixed `invalid_scope` for invalid answer text.

## Reproducible current adapter

```
cargo run -p sentinel-cli -- academy usb list
cargo run -p sentinel-cli -- academy usb evaluate composite-device selected_file_bytes
cargo run -p sentinel-cli -- academy usb evaluate keyboard-only nothing_measured
```

Success: one JSON document on stdout, empty stderr, exit 0. Failure: stdout empty, stderr one fixed code, exit 1. Wrong arity: usage exit 2 without argument echo. Commands never use their ID as a filesystem, device or policy target.

A future desktop wrapper request may use this shape (not a registered native/Tauri/RPC method):

```json
{"scenarioId":"composite-device","scope":"selected_file_bytes"}
```

Feedback fields for that request:

```json
{"scenarioId":"composite-device","selectedScope":"selected_file_bytes","recommendedScope":"selected_file_bytes","correct":true,"explanation":"This synthetic file check covers only selected file bytes. It does not establish safety of the separate keyboard interface or firmware. Storage inspection and input approval require separate evidence; an ordinary file result cannot authorize input or release a device. You matched the limited illustrated scope.","limitationKeys":["selected_files_only","input_not_assessed","firmware_not_assessed"],"safeAction":"Treat storage and input as separate questions. Do not plug unfamiliar composite hardware into the daily-use computer or rely on a file result to approve it. Use owned recoverable lab equipment for later policy tests.","synthetic":true}
```

The library and CLI supply actual serialized DTOs. Desktop bridge wiring is not implemented here; GLM should consume the Rust functions through a separately reviewed local adapter.

## Visitor flow and truthful states

1. Label prompt and feedback **Synthetic training scenario** before interaction. Scenario `interfaces` describes the invented illustration, never an observed attached device. `fileSampleChecked` is illustrative, not live evidence.
2. Ask what the illustrated file-byte check can tell us: selected file bytes, typing/input behavior, firmware safety or nothing measured. Store no real hardware identifiers or visitor device data.
3. Storage/composite scenarios illustrate only selected file bytes. Keyboard-only illustrates no file evidence and returns `nothing_measured`, with `no_file_sample` rather than `selected_files_only`.
4. `correct` is learning correctness. A correct answer never establishes protection, grants permission, approves/release hardware or updates a global shield. DTOs have no protection Assessment or live capability fields.
5. Always show limitations and safe action. Keys are `selected_files_only` OR `no_file_sample`, plus `input_not_assessed` and `firmware_not_assessed`. A device name/VID/PID is not proof; no file check certifies firmware or input safety.
6. Evaluation is synchronous and bounded: no progress bar, scan animation, cancellation job or artificial stage timing. For an asynchronous wrapper, disable duplicate submit until reply; ignore stale view replies and show adapter failure as unavailable feedback. No successful lesson result should be substituted for a missing adapter.
7. Optional learning completion is UI-local, stores only scenario ID/answer completion, is clearable and stays separate from protection. Backend is stateless and stores nothing. Keyboard feedback/retry/next and focus restoration remain GLM integration checks.
8. No request to connect an unknown device, generate keystrokes or test daily-machine blocking. CRYPTIC (E:) is not part of this lesson. Real passive observations are a different capability and need their own adapter/evidence.

## Acceptance and bounds

Fixed three descriptions ≤1024 bytes each; catalog JSON tested <8192 bytes and every feedback <4096 bytes. IDs bounded before lookup; no network, filesystem/device access, policy changes, model, secrets or free-form raw input. No new external dependency; internal intel-to-proto edge matches PR #26/#30.

Run `cargo test -p sentinel-intel --test usb_lesson` (six tests: all 12 scenario/answer pairs, input/composite separation, no-file evidence state, bounds/closed enums, labels and 50 repeat calls), `cargo test -p sentinel-cli --test usb_lesson` (two actual-process tests), and full `tools/verify.ps1`. Evidence: `docs/evidence/usb-autopsy.md`. GLM review/UI integration, reviewed merge and event-machine rehearsals remain pending.

Coordinator: preserve URL X-Ray #26 and Phishing Dojo #30 exports, dependency, CLI arms/help and STATUS append when integrating; there should be only one internal proto dependency entry. Do not merge this educational scope into real USB approval dispatch.
