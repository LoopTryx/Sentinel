use sentinel_intel::password_autopsy::{PasswordLessonError, evaluate_password_lesson};
use sentinel_proto::password_autopsy::PasswordChoice;

#[test]
fn each_synthetic_case_has_exactly_one_correct_choice() {
    let choices = [
        PasswordChoice::ReplacePredictable,
        PasswordChoice::MakeUnique,
        PasswordChoice::KeepUnique,
    ];
    for (index, id) in ["predictable", "reused", "unique_generated"]
        .iter()
        .enumerate()
    {
        for (choice_index, choice) in choices.iter().enumerate() {
            let result = evaluate_password_lesson(id, *choice).unwrap();
            assert_eq!(result.correct, index == choice_index);
            assert!(!result.protection_verdict);
            assert!(!result.real_credentials_accepted);
            assert!(!result.network_accessed);
            assert!(result.limitation.contains("No crack-time"));
        }
    }
}

#[test]
fn arbitrary_and_oversized_inputs_are_not_password_assessments() {
    for id in [
        "REUSED",
        "",
        "user-secret",
        "reused\n",
        &"x".repeat(33),
        &"é".repeat(17),
    ] {
        assert_eq!(
            evaluate_password_lesson(id, PasswordChoice::MakeUnique),
            Err(PasswordLessonError::InvalidScenario)
        );
    }
}
