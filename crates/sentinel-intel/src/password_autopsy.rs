use sentinel_proto::password_autopsy::{PasswordAutopsy, PasswordChoice};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PasswordLessonError {
    InvalidScenario,
}

/// Closed synthetic examples only. Never accepts, measures or stores a password.
pub fn evaluate_password_lesson(
    scenario: &str,
    choice: PasswordChoice,
) -> Result<PasswordAutopsy, PasswordLessonError> {
    if scenario.len() > 32 {
        return Err(PasswordLessonError::InvalidScenario);
    }
    let (description, observation, advice, expected) = match scenario {
        "predictable" => (
            "Invented example: a common word with a predictable suffix.",
            "Common patterns are easier to guess; adding a digit does not remove predictability.",
            "Replace predictable patterns with a long, independently generated, unique password.",
            PasswordChoice::ReplacePredictable,
        ),
        "reused" => (
            "Invented example: the same password used for two accounts.",
            "A stolen password from one account can be tried against another, regardless of its length.",
            "Use a distinct password for every account and enable supported multi-factor authentication.",
            PasswordChoice::MakeUnique,
        ),
        "unique_generated" => (
            "Invented example: a long, independently generated password used for one account.",
            "Uniqueness and independent generation reduce common guessing and reuse risks.",
            "Keep it unique, store it in a reviewed password manager, and use supported multi-factor authentication.",
            PasswordChoice::KeepUnique,
        ),
        _ => return Err(PasswordLessonError::InvalidScenario),
    };
    Ok(PasswordAutopsy {
        schema_version: 1,
        mode: "synthetic_lesson".into(),
        scenario_id: scenario.into(),
        example_description: description.into(),
        observation: observation.into(),
        advice: advice.into(),
        limitation: "Educational examples only. No real credential was assessed. No crack-time, breach status, account safety or resistance to phishing is established.".into(),
        choice,
        correct: choice == expected,
        protection_verdict: false,
        real_credentials_accepted: false,
        network_accessed: false,
    })
}
