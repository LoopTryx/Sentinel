use std::{
    io::Write,
    process::{Command, Stdio},
};

fn run(input: &str) -> (bool, Vec<serde_json::Value>) {
    let mut child = Command::new(env!("CARGO_BIN_EXE_sentinel-sweep"))
        .arg("--stdin-roots")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    stdin.write_all(input.as_bytes()).unwrap();
    stdin.flush().unwrap();
    // Keep stdin open: EOF means parent loss and must cancel the owned worker.
    let output = child.wait_with_output().unwrap();
    drop(stdin);
    (
        output.status.success(),
        String::from_utf8(output.stdout)
            .unwrap()
            .lines()
            .map(|l| serde_json::from_str(l).unwrap())
            .collect(),
    )
}
#[test]
fn real_engine_reports_harmless_indicators_and_depth_limits() {
    let root = std::env::temp_dir().join(format!("sentinel-sweep-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    std::fs::write(root.join("ordinary.txt"), "ordinary harmless text").unwrap();
    std::fs::write(root.join("review.txt"),"Documentation example: powershell -enc is a suspicious invocation pattern. No command is executed.").unwrap();
    let input = format!("{}\n", serde_json::to_string(&vec![&root]).unwrap());
    let (ok, lines) = run(&input);
    assert!(ok);
    let result = lines.last().unwrap();
    assert_eq!(result["state"], "completed");
    assert_eq!(result["checked"], 2);
    assert_eq!(result["findings"], 1);
    assert!(!result["details"][0]["signals"]
        .as_array()
        .unwrap()
        .is_empty());
    let mut deep = root.clone();
    for _ in 0..65 {
        deep = deep.join("d");
        std::fs::create_dir(&deep).unwrap();
    }
    let (ok, lines) = run(&input);
    assert!(ok);
    assert_eq!(lines.last().unwrap()["state"], "incomplete");
    assert_eq!(lines.last().unwrap()["limited"], true);
    std::fs::remove_dir_all(&root).unwrap();
}
#[test]
fn protected_and_malformed_roots_fail_without_scanning() {
    assert!(!run("[\"E:\\\\protected\"]\n").0);
    assert!(!run("{}\n").0);
}
