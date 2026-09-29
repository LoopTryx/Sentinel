use serde::{Deserialize, Serialize};
use shield_proto::assessment::Assessment;
use shield_proto::capability::CapabilityStatus;
use shield_proto::jobs::Job;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StatusFixture {
    mode: String,
    assessment: Assessment,
    capabilities: Vec<CapabilityStatus>,
    job: Job,
}

fn main() {
    if std::env::args().skip(1).collect::<Vec<_>>() != ["status", "--fixture"] {
        eprintln!("Usage: shield-cli status --fixture (no live protection is installed)");
        std::process::exit(2);
    }

    let fixture: StatusFixture =
        serde_json::from_str(include_str!("../../../data/fixtures/status.json"))
            .expect("checked-in status fixture must match Rust contracts");
    println!("{}", serde_json::to_string(&fixture).unwrap());
}
