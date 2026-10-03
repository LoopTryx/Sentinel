use sentinel_intel::cache::Cache;
use sentinel_intel::providers::{MAX_FEED_BYTES, UrlhausFeed};
use sentinel_proto::status::StatusSnapshot;
use sentinel_scan::pipeline::{DirectoryLimits, ScanLimits, scan_directory, scan_file};
use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.as_slice() {
        [command, lesson, action]
            if command == "academy" && lesson == "usb" && action == "list" =>
        {
            println!(
                "{}",
                serde_json::to_string(&sentinel_intel::usb_lesson::usb_lesson_scenarios())
                    .expect("static scenarios serialize")
            );
            Ok(())
        }
        [command, lesson, action, id, scope]
            if command == "academy" && lesson == "usb" && action == "evaluate" =>
        {
            evaluate_usb_lesson(id, scope)
        }
        [command, flag] if command == "status" && flag == "--fixture" => status_fixture(),
        [command, action, feed_path, cache_dir]
            if command == "intel" && action == "import-local" =>
        {
            import_local(feed_path, cache_dir)
        }
        [command, action, cache_dir, url] if command == "intel" && action == "lookup-offline" => {
            lookup_offline(cache_dir, url)
        }
        [command, action, path] if command == "scan" && action == "file" => scan_local_file(path),
        [command, action, path] if command == "scan" && action == "directory" => {
            scan_local_directory(path)
        }
        _ => {
            eprintln!(
                "Usage: sentinel-cli academy usb list | academy usb evaluate <scenario-id> <scope> | status --fixture | intel import-local <feed-file> <cache-dir> | intel lookup-offline <cache-dir> <url> | scan file <path> | scan directory <path>"
            );
            eprintln!("No live protection or provider download is installed");
            std::process::exit(2);
        }
    };
    if let Err(error) = result {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn scan_local_directory(path: &str) -> Result<(), &'static str> {
    let result = scan_directory(
        path,
        ScanLimits::default(),
        DirectoryLimits::default(),
        || false,
    );
    println!(
        "{}",
        serde_json::to_string(&serde_json::json!({
            "mode": "local_read_only_preview",
            "profile": "custom_directory",
            "coverage": "partial",
            "result": result,
        }))
        .expect("scan report is serializable")
    );
    Ok(())
}

fn scan_local_file(path: &str) -> Result<(), &'static str> {
    let result = scan_file(path, ScanLimits::default());
    println!(
        "{}",
        serde_json::to_string(&serde_json::json!({
            "mode": "local_read_only_preview",
            "profile": "single_file",
            "coverage": "partial",
            "result": result,
        }))
        .expect("scan report is serializable")
    );
    Ok(())
}

fn status_fixture() -> Result<(), &'static str> {
    let fixture: StatusSnapshot =
        serde_json::from_str(include_str!("../../../data/fixtures/status.json"))
            .expect("checked-in status fixture must match Rust contracts");
    println!(
        "{}",
        serde_json::to_string(&fixture).expect("status is serializable")
    );
    Ok(())
}

fn import_local(feed_path: &str, cache_dir: &str) -> Result<(), &'static str> {
    let size = std::fs::metadata(feed_path)
        .map_err(|_| "Cannot inspect local feed")?
        .len();
    if size > MAX_FEED_BYTES as u64 {
        return Err("Local feed exceeds size limit");
    }
    let bytes = std::fs::read(feed_path).map_err(|_| "Cannot read local feed")?;
    let feed = UrlhausFeed::parse(&bytes, now()?, 60 * 60).map_err(|_| "Local feed is invalid")?;
    let mut cache = Cache::open(cache_dir).map_err(|_| "Cannot open cache")?;
    cache
        .activate(&feed)
        .map_err(|_| "Cannot activate local feed")?;
    println!(
        "{}",
        serde_json::json!({"provider": feed.provider, "entries": feed.urls.len(), "expiresAt": feed.expires_at})
    );
    Ok(())
}

fn lookup_offline(cache_dir: &str, url: &str) -> Result<(), &'static str> {
    let cache = Cache::open(cache_dir).map_err(|_| "Cannot open cache")?;
    let result = cache.lookup(url, now()?);
    println!(
        "{}",
        serde_json::to_string(&result).expect("lookup result is serializable")
    );
    Ok(())
}

fn now() -> Result<u64, &'static str> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "System time is invalid")?
        .as_secs())
}

fn evaluate_usb_lesson(id: &str, scope: &str) -> Result<(), &'static str> {
    use sentinel_proto::usb_lesson::{UsbLessonError, UsbLessonScope};
    let scope = match scope {
        "selected_file_bytes" => UsbLessonScope::SelectedFileBytes,
        "input_behavior" => UsbLessonScope::InputBehavior,
        "firmware_safety" => UsbLessonScope::FirmwareSafety,
        "nothing_measured" => UsbLessonScope::NothingMeasured,
        _ => return Err("invalid_scope"),
    };
    let feedback =
        sentinel_intel::usb_lesson::evaluate_usb_lesson(id, scope).map_err(
            |error| match error {
                UsbLessonError::InvalidScenarioId => "invalid_scenario_id",
                UsbLessonError::UnknownScenario => "unknown_scenario",
            },
        )?;
    println!(
        "{}",
        serde_json::to_string(&feedback).expect("static feedback serializes")
    );
    Ok(())
}
