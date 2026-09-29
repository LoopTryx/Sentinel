use shield_intel::cache::Cache;
use shield_intel::providers::{MAX_FEED_BYTES, UrlhausFeed};
use shield_proto::status::StatusSnapshot;
use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.as_slice() {
        [command, flag] if command == "status" && flag == "--fixture" => status_fixture(),
        [command, action, feed_path, cache_dir]
            if command == "intel" && action == "import-local" =>
        {
            import_local(feed_path, cache_dir)
        }
        [command, action, cache_dir, url] if command == "intel" && action == "lookup-offline" => {
            lookup_offline(cache_dir, url)
        }
        _ => {
            eprintln!(
                "Usage: shield-cli status --fixture | intel import-local <feed-file> <cache-dir> | intel lookup-offline <cache-dir> <url>"
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
