use sentinel_intel::phishing::{evaluate_phishing, phishing_scenarios};
use sentinel_proto::phishing::{PhishingChoice, PhishingError};

#[test]
fn every_scenario_is_synthetic_bounded_and_has_one_safe_choice() {
    let scenarios = phishing_scenarios();
    assert_eq!(scenarios.len(), 3);
    for scenario in scenarios {
        assert!(scenario.synthetic);
        assert!(scenario.message.len() <= 1024);
        assert!(scenario.message.contains(".invalid") || !scenario.message.contains("http"));
        let mut correct = 0;
        for choice in [
            PhishingChoice::FollowRequest,
            PhishingChoice::VerifySeparately,
            PhishingChoice::Ignore,
        ] {
            let feedback = evaluate_phishing(&scenario.id, choice).unwrap();
            assert!(feedback.synthetic);
            assert_eq!(feedback.scenario_id, scenario.id);
            assert_eq!(feedback.selected_choice, choice);
            assert!(!feedback.explanation.is_empty());
            assert!(!feedback.safe_action.is_empty());
            assert!(serde_json::to_vec(&feedback).unwrap().len() < 4096);
            if feedback.correct {
                correct += 1;
            }
        }
        assert_eq!(correct, 1);
    }
}

#[test]
fn otp_and_payment_scenarios_explain_concrete_clues() {
    for id in ["otp-request", "payment-pressure"] {
        let feedback = evaluate_phishing(id, PhishingChoice::VerifySeparately).unwrap();
        assert!(feedback.correct);
        assert!(!feedback.clue_keys.is_empty());
        assert!(feedback.explanation.contains("synthetic"));
        assert!(feedback.safe_action.contains("independently"));
        assert!(
            !evaluate_phishing(id, PhishingChoice::FollowRequest)
                .unwrap()
                .correct
        );
    }
    let otp = evaluate_phishing("otp-request", PhishingChoice::FollowRequest).unwrap();
    assert!(otp.clue_keys.iter().any(|key| key == "secret_request"));
    let payment = evaluate_phishing("payment-pressure", PhishingChoice::FollowRequest).unwrap();
    assert!(
        payment
            .clue_keys
            .iter()
            .any(|key| key == "payment_pressure")
    );
}

#[test]
fn benign_counterexample_does_not_invent_a_phishing_verdict() {
    let feedback = evaluate_phishing("club-reminder", PhishingChoice::VerifySeparately).unwrap();
    assert!(feedback.correct);
    assert!(feedback.clue_keys.is_empty());
    assert!(feedback.explanation.contains("not proof"));
    assert!(
        feedback
            .explanation
            .contains("no request for money or secrets")
    );
}

#[test]
fn ids_are_bounded_and_errors_do_not_echo_input() {
    for invalid in [
        "".to_string(),
        "x".repeat(65),
        "é".to_string(),
        "otp-request\n".to_string(),
        "../otp-request".to_string(),
    ] {
        assert_eq!(
            evaluate_phishing(&invalid, PhishingChoice::Ignore),
            Err(PhishingError::InvalidScenarioId)
        );
    }
    assert_eq!(
        evaluate_phishing("missing", PhishingChoice::Ignore),
        Err(PhishingError::UnknownScenario)
    );
    assert_eq!(
        serde_json::to_string(&PhishingError::InvalidScenarioId).unwrap(),
        "\"invalid_scenario_id\""
    );
    assert!(serde_json::from_str::<PhishingChoice>("\"execute\"").is_err());
}

#[test]
fn repeated_visitors_receive_deterministic_stateless_feedback() {
    let first = evaluate_phishing("otp-request", PhishingChoice::Ignore).unwrap();
    for _ in 0..50 {
        assert_eq!(
            evaluate_phishing("otp-request", PhishingChoice::Ignore).unwrap(),
            first
        );
    }
    assert!(serde_json::to_vec(&phishing_scenarios()).unwrap().len() < 8192);
}
