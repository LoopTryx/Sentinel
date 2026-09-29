use shield_proto::status::StatusSnapshot;

fn main() {
    if std::env::args().skip(1).collect::<Vec<_>>() != ["status", "--fixture"] {
        eprintln!("Usage: shield-cli status --fixture (no live protection is installed)");
        std::process::exit(2);
    }

    let fixture: StatusSnapshot =
        serde_json::from_str(include_str!("../../../data/fixtures/status.json"))
            .expect("checked-in status fixture must match Rust contracts");
    println!("{}", serde_json::to_string(&fixture).unwrap());
}
