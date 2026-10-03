//! Synthetic USB education only. Never enumerates devices or applies policy.
use sentinel_proto::usb_lesson::{
    UsbLessonError, UsbLessonFeedback, UsbLessonInterface, UsbLessonScenario, UsbLessonScope,
};

struct Scenario {
    id: &'static str,
    title: &'static str,
    description: &'static str,
    interfaces: &'static [UsbLessonInterface],
    file_checked: bool,
    explanation: &'static str,
    action: &'static str,
}

const SCENARIOS: [Scenario; 3] = [
    Scenario {
        id: "selected-storage",
        title: "A storage sample",
        description: "Synthetic illustration: a storage device contains an invented notebook file. A limited byte check of that selected sample reports no test-string finding. No physical device is connected or tested by this lesson.",
        interfaces: &[UsbLessonInterface::Storage],
        file_checked: true,
        explanation: "In this synthetic illustration, the check covers only selected file bytes. It does not establish firmware safety, all-file safety or permission to trust the device. A hash identifies sampled bytes; it is not a safety certificate.",
        action: "Use only owner-approved benign samples for demonstrations. Keep Defender enabled and keep unfamiliar hardware away from the daily-use computer; arrange separate expert inspection if needed.",
    },
    Scenario {
        id: "keyboard-only",
        title: "An input device",
        description: "Synthetic illustration: a device presents a keyboard interface and no storage sample is available. There are no selected file bytes to check. No keystrokes are generated or captured.",
        interfaces: &[UsbLessonInterface::Input],
        file_checked: false,
        explanation: "This synthetic scenario has no selected storage file, so nothing is measured by a file-byte check. The keyboard interface does not establish trusted input behavior. Device labels and names are not proof of identity or firmware safety.",
        action: "Do not try unfamiliar input hardware on the daily-use computer. Seek expert advice or use owned recoverable lab equipment for any later device investigation.",
    },
    Scenario {
        id: "composite-device",
        title: "Storage plus keyboard",
        description: "Synthetic illustration: one device presents storage and keyboard interfaces. A limited byte check of an invented selected file reports no test-string finding. No real hardware or interface approval occurs.",
        interfaces: &[UsbLessonInterface::Storage, UsbLessonInterface::Input],
        file_checked: true,
        explanation: "This synthetic file check covers only selected file bytes. It does not establish safety of the separate keyboard interface or firmware. Storage inspection and input approval require separate evidence; an ordinary file result cannot authorize input or release a device.",
        action: "Treat storage and input as separate questions. Do not plug unfamiliar composite hardware into the daily-use computer or rely on a file result to approve it. Use owned recoverable lab equipment for later policy tests.",
    },
];

/// Returns a fixed educational catalog. Every field describes an invented scenario.
pub fn usb_lesson_scenarios() -> Vec<UsbLessonScenario> {
    SCENARIOS
        .iter()
        .map(|scenario| UsbLessonScenario {
            id: scenario.id.into(),
            title: scenario.title.into(),
            description: scenario.description.into(),
            interfaces: scenario.interfaces.to_vec(),
            file_sample_checked: scenario.file_checked,
            synthetic: true,
        })
        .collect()
}

/// Returns immediate stateless scope feedback. ID is never a device/path/policy target.
pub fn evaluate_usb_lesson(
    id: &str,
    scope: UsbLessonScope,
) -> Result<UsbLessonFeedback, UsbLessonError> {
    if id.is_empty()
        || id.len() > 64
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return Err(UsbLessonError::InvalidScenarioId);
    }
    let scenario = SCENARIOS
        .iter()
        .find(|scenario| scenario.id == id)
        .ok_or(UsbLessonError::UnknownScenario)?;
    let recommended = if scenario.file_checked {
        UsbLessonScope::SelectedFileBytes
    } else {
        UsbLessonScope::NothingMeasured
    };
    let correct = scope == recommended;
    let note = if correct {
        "You matched the limited illustrated scope."
    } else {
        match scope {
            UsbLessonScope::SelectedFileBytes => "No file sample is present in this scenario.",
            UsbLessonScope::InputBehavior => "File-byte checks cannot prove input behavior.",
            UsbLessonScope::FirmwareSafety => "Firmware safety was not measured.",
            UsbLessonScope::NothingMeasured => {
                "This scenario includes a limited file-byte illustration."
            }
        }
    };
    Ok(UsbLessonFeedback {
        scenario_id: scenario.id.into(),
        selected_scope: scope,
        recommended_scope: recommended,
        correct,
        explanation: format!("{} {}", scenario.explanation, note),
        limitation_keys: vec![
            if scenario.file_checked {
                "selected_files_only"
            } else {
                "no_file_sample"
            }
            .into(),
            "input_not_assessed".into(),
            "firmware_not_assessed".into(),
        ],
        safe_action: scenario.action.into(),
        synthetic: true,
    })
}
