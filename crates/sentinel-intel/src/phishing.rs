//! Static educational scenarios. No message ingestion, network or protection assessment.
use sentinel_proto::phishing::{PhishingChoice, PhishingError, PhishingFeedback, PhishingScenario};

struct Scenario {
    id: &'static str,
    title: &'static str,
    message: &'static str,
    clues: &'static [&'static str],
    explanation: &'static str,
    action: &'static str,
}

const SCENARIOS: [Scenario; 3] = [
    Scenario {
        id: "otp-request",
        title: "The account rescue",
        message: "Synthetic message: Your school account expires in ten minutes! Send your one-time login code to our support chat at https://school-help.invalid/verify.",
        clues: &["secret_request", "urgency", "unverified_destination"],
        explanation: "This synthetic request combines urgency with a request for a login secret. A one-time code can authorize access. The displayed destination is an invented training domain; a familiar name does not establish identity.",
        action: "Do not share the code or follow the message link. Contact the school through an independently known channel.",
    },
    Scenario {
        id: "payment-pressure",
        title: "The urgent prize fee",
        message: "Synthetic message: You won a tablet! Pay the delivery fee in the next five minutes using https://prize-fee.invalid/pay or lose your prize.",
        clues: &["payment_pressure", "urgency", "unexpected_reward"],
        explanation: "This synthetic prize offer pressures you to pay before checking the claim. Payment demands, unexpected rewards and urgency are clues worth investigating; they are not a universal classifier for real messages.",
        action: "Do not pay through the message. Verify the offer independently with the organizer using contact details you already trust.",
    },
    Scenario {
        id: "club-reminder",
        title: "The ordinary reminder",
        message: "Synthetic message: Robotics club meets in room 12 tomorrow at lunch. Bring your notebook. Check the club noticeboard if the time changes.",
        clues: &[],
        explanation: "This synthetic reminder has no request for money or secrets and no link. That is not proof of a real sender's identity. Checking the known noticeboard is proportionate; treating every ordinary reminder as proven phishing is misleading.",
        action: "Check the club noticeboard independently if you need confirmation. No password, payment or special permission is needed.",
    },
];

/// Returns three invented scenarios. Display their synthetic label before interaction.
pub fn phishing_scenarios() -> Vec<PhishingScenario> {
    SCENARIOS
        .iter()
        .map(|scenario| PhishingScenario {
            id: scenario.id.into(),
            title: scenario.title.into(),
            message: scenario.message.into(),
            synthetic: true,
        })
        .collect()
}

/// Stateless educational feedback for a bounded ID and closed choice enum.
/// Never pass raw messages or secrets here; learning correctness is not protection.
pub fn evaluate_phishing(
    id: &str,
    choice: PhishingChoice,
) -> Result<PhishingFeedback, PhishingError> {
    if id.is_empty()
        || id.len() > 64
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return Err(PhishingError::InvalidScenarioId);
    }
    let scenario = SCENARIOS
        .iter()
        .find(|scenario| scenario.id == id)
        .ok_or(PhishingError::UnknownScenario)?;
    let choice_note = match choice {
        PhishingChoice::VerifySeparately => {
            "You chose independent verification, the recommended learning response."
        }
        PhishingChoice::FollowRequest => {
            "Following a message request without checking its source can expose you to deception. No action was performed in this lesson."
        }
        PhishingChoice::Ignore => {
            "Ignoring a suspicious request avoids acting on it, but independent verification can resolve uncertainty or confirm an ordinary reminder."
        }
    };
    Ok(PhishingFeedback {
        scenario_id: scenario.id.into(),
        selected_choice: choice,
        correct: choice == PhishingChoice::VerifySeparately,
        clue_keys: scenario.clues.iter().map(|key| (*key).into()).collect(),
        explanation: format!("{} {}", scenario.explanation, choice_note),
        safe_action: scenario.action.into(),
        synthetic: true,
    })
}
