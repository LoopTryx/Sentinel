use sentinel_av::{engine::Engine, inspection_wire::inspection_snapshot};
use sentinel_proto::{
    assessment::Coverage,
    file_inspection::{FileInspectionFinding, FileInspectionState, FileInspectionVerdict},
};

#[test]
fn actual_reports_map_to_path_free_precise_contracts() {
    let root = std::env::temp_dir().join(format!("sentinel-wire-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join("private-name.txt");
    std::fs::write(&path, b"ordinary harmless text").unwrap();
    let engine = Engine::new();
    let report = engine.scan_file(&path, &|_| None);
    let dto = inspection_snapshot("report_1", &report).unwrap();
    assert_eq!(dto.state, FileInspectionState::Completed);
    assert_eq!(dto.verdict, FileInspectionVerdict::NoneObserved);
    assert_eq!(dto.coverage, Coverage::Partial);
    assert_eq!(dto.inspected_bytes, "22");
    assert!(!format!("{dto:?}").contains("private-name"));
    assert!(inspection_snapshot("C:/private", &report).is_err());
    let mut inconsistent = report.clone();
    inconsistent.bytes_inspected = 23;
    assert!(inspection_snapshot("report_1", &inconsistent).is_err());
    let empty_disguised = root.join("invoice.pdf.exe");
    std::fs::write(&empty_disguised, []).unwrap();
    let empty_report = engine.scan_file(&empty_disguised, &|_| None);
    let empty_dto = inspection_snapshot("empty_1", &empty_report).unwrap();
    assert_eq!(empty_dto.verdict, FileInspectionVerdict::Suspicious);
    assert!(empty_dto
        .findings
        .contains(&FileInspectionFinding::DisguisedFilename));
    let large = root.join("large.txt");
    std::fs::File::create(&large)
        .unwrap()
        .set_len(64 * 1024 * 1024)
        .unwrap();
    let dto = inspection_snapshot("report_2", &engine.scan_file(&large, &|_| None)).unwrap();
    assert_eq!(dto.state, FileInspectionState::Partial);
    assert_eq!(dto.verdict, FileInspectionVerdict::Suspicious);
    assert_eq!(dto.inspected_bytes, (8 * 1024 * 1024).to_string());
    assert!(dto.sha256.is_none());
    assert_eq!(dto.evidence.unwrap().zero_permille, 1000);
    assert!(dto
        .findings
        .contains(&FileInspectionFinding::LargeZeroFilledRange));
    std::fs::remove_dir_all(root).unwrap();
}
