# Password Autopsy S1 logic handoff

Issue #14, Codex logic / GLM presentation. This offline lesson accepts only three curated synthetic IDs: `predictable`, `reused`, `unique_generated`. Do not add a password input field: the API does not accept or measure real credentials. Present the scenario descriptions and three answer buttons; submit an answer to show the observation, advice, limitation and correct/incorrect feedback.

Rust: `sentinel_intel::password_autopsy::evaluate_password_lesson(scenario: &str, choice: PasswordChoice) -> Result<PasswordAutopsy, PasswordLessonError>`. The error is InvalidScenario, with no rejected input. Scenario IDs are case-sensitive and bounded to 32 UTF-8 bytes. Generated TS: PasswordAutopsy.ts and PasswordChoice.ts. Native/Tauri wiring is not registered by this leaf.

Choices: `replace_predictable`, `make_unique`, `keep_unique`. They respectively answer the predictable, reused, and unique_generated examples. Wrong answers return normal feedback with correct=false; successful invocation alone must not mark learning complete. Completion is a learning state, never protection state.

CLI demo: `cargo run -p sentinel-cli -- academy password-autopsy reused make_unique`. Invalid scenarios and choice strings give generic errors without echoing input. CLI arguments are not a place for real passwords.

Result: schemaVersion=1, mode=synthetic_lesson, scenarioId, exampleDescription, observation, advice, limitation, choice, correct. protectionVerdict, realCredentialsAccepted and networkAccessed are always false. No password value, strength score, crack time, breach query, vault record, file access, or account action exists. Display limitation beside the feedback; the generated example reduces common guessing/reuse risks but does not establish safety or phishing resistance.

Keep private/user data out of logs and assistant prompts. Wording/translation and rendering belong to GLM. Coordinator: serialize shared proto/intel exports, existing internal dependency, CLI match arms and help text with PR #26/#30/#32. Preserve all lesson modules when integrating.
