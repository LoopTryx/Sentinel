use sentinel_intel::usb_lesson::{evaluate_usb_lesson, usb_lesson_scenarios};
use sentinel_proto::usb_lesson::{UsbLessonError, UsbLessonScope};

#[test]
fn all_scenario_answers_explain_actual_file_scope() {
    for (id, expected) in [
        ("selected-storage", UsbLessonScope::SelectedFileBytes),
        ("keyboard-only", UsbLessonScope::NothingMeasured),
        ("composite-device", UsbLessonScope::SelectedFileBytes),
    ] {
        for answer in [
            UsbLessonScope::SelectedFileBytes,
            UsbLessonScope::InputBehavior,
            UsbLessonScope::FirmwareSafety,
            UsbLessonScope::NothingMeasured,
        ] {
            let feedback = evaluate_usb_lesson(id, answer).unwrap();
            assert_eq!(feedback.scenario_id, id);
            assert_eq!(feedback.selected_scope, answer);
            assert_eq!(feedback.recommended_scope, expected);
            assert_eq!(feedback.correct, answer == expected);
            assert!(feedback.synthetic);
            assert!(
                feedback
                    .limitation_keys
                    .iter()
                    .any(|key| key == "firmware_not_assessed")
            );
            assert!(feedback.explanation.contains("synthetic"));
            assert!(!feedback.safe_action.is_empty());
            assert!(serde_json::to_vec(&feedback).unwrap().len() < 4096);
        }
    }
}

#[test]
fn input_and_composite_interfaces_never_inherit_storage_safety() {
    for id in ["keyboard-only", "composite-device"] {
        let feedback = evaluate_usb_lesson(id, UsbLessonScope::InputBehavior).unwrap();
        assert!(!feedback.correct);
        assert!(
            feedback
                .limitation_keys
                .iter()
                .any(|key| key == "input_not_assessed")
        );
        assert!(feedback.explanation.contains("does not establish"));
        assert!(feedback.safe_action.contains("daily-use"));
    }
    let composite =
        evaluate_usb_lesson("composite-device", UsbLessonScope::SelectedFileBytes).unwrap();
    assert!(composite.correct);
    assert!(composite.explanation.contains("selected file bytes"));
    assert!(composite.explanation.contains("keyboard"));
}

#[test]
fn catalog_is_small_labeled_and_does_not_contain_real_devices() {
    let scenarios = usb_lesson_scenarios();
    assert_eq!(scenarios.len(), 3);
    assert!(serde_json::to_vec(&scenarios).unwrap().len() < 8192);
    for scenario in scenarios {
        assert!(scenario.synthetic);
        assert!(scenario.description.contains("Synthetic"));
        assert!(scenario.description.len() <= 1024);
        assert!(!scenario.interfaces.is_empty());
        assert!(!scenario.description.contains("E:"));
        assert_eq!(scenario.file_sample_checked, scenario.id != "keyboard-only");
    }
}

#[test]
fn invalid_and_unknown_ids_are_distinct_without_echoing_input() {
    for id in [
        "".to_string(),
        "s".repeat(65),
        "../selected-storage".to_string(),
        "ä".to_string(),
        "keyboard-only\n".to_string(),
    ] {
        assert_eq!(
            evaluate_usb_lesson(&id, UsbLessonScope::FirmwareSafety),
            Err(UsbLessonError::InvalidScenarioId)
        );
    }
    assert_eq!(
        evaluate_usb_lesson(&"a".repeat(64), UsbLessonScope::FirmwareSafety),
        Err(UsbLessonError::UnknownScenario)
    );
    assert!(serde_json::from_str::<UsbLessonScope>("\"allow_device\"").is_err());
    assert_eq!(
        serde_json::to_string(&UsbLessonError::InvalidScenarioId).unwrap(),
        "\"invalid_scenario_id\""
    );
}

#[test]
fn repeated_visitors_are_stateless() {
    let first = evaluate_usb_lesson("selected-storage", UsbLessonScope::FirmwareSafety).unwrap();
    for _ in 0..50 {
        assert_eq!(
            evaluate_usb_lesson("selected-storage", UsbLessonScope::FirmwareSafety).unwrap(),
            first
        );
    }
}

#[test]
fn no_file_sample_never_claims_selected_file_coverage() {
    let feedback = evaluate_usb_lesson("keyboard-only", UsbLessonScope::NothingMeasured).unwrap();
    assert!(
        feedback
            .limitation_keys
            .iter()
            .any(|key| key == "no_file_sample")
    );
    assert!(
        !feedback
            .limitation_keys
            .iter()
            .any(|key| key == "selected_files_only")
    );
}
