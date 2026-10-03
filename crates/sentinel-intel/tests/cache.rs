use sentinel_intel::cache::{Cache, LookupVerdict};
use sentinel_intel::providers::UrlhausFeed;
use std::path::PathBuf;

fn directory(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!("sentinel-intel-{label}-{}", std::process::id()))
}

#[test]
fn repeated_updates_keep_bounded_history_and_unrelated_files() {
    let dir = directory("retention");
    let _ = std::fs::remove_dir_all(&dir);
    let mut cache = Cache::open(&dir).unwrap();
    std::fs::write(dir.join("notes.json"), b"keep").unwrap();
    std::fs::write(dir.join("snapshot-not-owned.json"), b"keep").unwrap();
    std::fs::write(
        dir.join("snapshot-000000000000000000000000000000000000001.json"),
        b"interrupted",
    )
    .unwrap();
    for time in 100..120 {
        let url = format!("https://example.test/{time}\n");
        cache
            .activate(&UrlhausFeed::parse(url.as_bytes(), time, 60).unwrap())
            .unwrap();
    }
    let mut markers: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "ready"))
        .collect();
    markers.sort();
    assert_eq!(markers.len(), 3, "unbounded ready history");
    let data_count = std::fs::read_dir(&dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| {
            path.file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("snapshot-")
                && path.extension().is_some_and(|ext| ext == "json")
        })
        .count();
    assert_eq!(data_count, 4); // three owned snapshots plus unrelated snapshot-not-owned
    assert_eq!(std::fs::read(dir.join("notes.json")).unwrap(), b"keep");
    assert_eq!(
        std::fs::read(dir.join("snapshot-not-owned.json")).unwrap(),
        b"keep"
    );
    std::fs::write(markers.last().unwrap(), b"broken").unwrap();
    let reopened = Cache::open(&dir).unwrap();
    assert_eq!(
        reopened.lookup("https://example.test/118", 120).verdict,
        LookupVerdict::Listed
    );
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn startup_does_not_validate_beyond_three_owned_candidates() {
    let dir = directory("candidate-budget");
    let _ = std::fs::remove_dir_all(&dir);
    Cache::open(&dir)
        .unwrap()
        .activate(&UrlhausFeed::parse(b"https://example.test/old\n", 100, 60).unwrap())
        .unwrap();
    for generation in [u128::MAX - 2, u128::MAX - 1, u128::MAX] {
        std::fs::write(
            dir.join(format!("snapshot-{generation:039}.ready")),
            b"broken",
        )
        .unwrap();
    }
    assert_eq!(
        Cache::open(&dir)
            .unwrap()
            .lookup("https://example.test/old", 120)
            .verdict,
        LookupVerdict::Unavailable
    );
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn stale_cache_instance_cannot_roll_back_newer_persisted_feed() {
    let dir = directory("stale-instance");
    let _ = std::fs::remove_dir_all(&dir);
    let mut first = Cache::open(&dir).unwrap();
    let mut stale = Cache::open(&dir).unwrap();
    first
        .activate(&UrlhausFeed::parse(b"https://example.test/new\n", 110, 60).unwrap())
        .unwrap();
    assert_eq!(
        stale.activate(&UrlhausFeed::parse(b"https://example.test/old\n", 100, 60).unwrap()),
        Err(sentinel_intel::cache::CacheError::StaleCandidate)
    );
    assert_eq!(
        Cache::open(&dir)
            .unwrap()
            .lookup("https://example.test/new", 120)
            .verdict,
        LookupVerdict::Listed
    );
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn cache_lock_rejects_competing_open_and_activation_until_released() {
    let dir = directory("cache-lock");
    let _ = std::fs::remove_dir_all(&dir);
    let mut cache = Cache::open(&dir).unwrap();
    let lock = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(dir.join(".snapshot.lock"))
        .unwrap();
    lock.try_lock().unwrap();
    assert_eq!(
        Cache::open(&dir).err(),
        Some(sentinel_intel::cache::CacheError::Busy)
    );
    let feed = UrlhausFeed::parse(b"https://example.test/new\n", 100, 60).unwrap();
    assert_eq!(
        cache.activate(&feed),
        Err(sentinel_intel::cache::CacheError::Busy)
    );
    drop(lock);
    cache.activate(&feed).unwrap();
    assert_eq!(
        Cache::open(&dir)
            .unwrap()
            .lookup("https://example.test/new", 120)
            .verdict,
        LookupVerdict::Listed
    );
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn retention_keeps_two_verified_fallbacks_and_monotonic_generation_names() {
    let dir = directory("rollback-set");
    let _ = std::fs::remove_dir_all(&dir);
    let mut cache = Cache::open(&dir).unwrap();
    let future = u128::MAX - 10;
    std::fs::write(
        dir.join(format!("snapshot-{future:039}.json")),
        b"interrupted",
    )
    .unwrap();
    for time in 100..105 {
        let url = format!("https://example.test/{time}\n");
        cache
            .activate(&UrlhausFeed::parse(url.as_bytes(), time, 60).unwrap())
            .unwrap();
    }
    let mut markers: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "ready"))
        .collect();
    markers.sort();
    assert_eq!(markers.len(), 3);
    assert!(
        markers[0].file_stem().unwrap().to_str().unwrap()
            > format!("snapshot-{future:039}").as_str()
    );
    for marker in &markers[1..] {
        std::fs::write(marker, b"broken").unwrap();
    }
    assert_eq!(
        Cache::open(&dir)
            .unwrap()
            .lookup("https://example.test/102", 120)
            .verdict,
        LookupVerdict::Listed
    );
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn offline_cache_keeps_exact_provenance_and_expiry() {
    let dir = directory("offline");
    let _ = std::fs::remove_dir_all(&dir);
    let feed = UrlhausFeed::parse(b"https://malware.test/payload\n", 100, 60).unwrap();
    Cache::open(&dir).unwrap().activate(&feed).unwrap();
    let cache = Cache::open(&dir).unwrap();
    assert_eq!(
        cache.lookup("https://malware.test/payload", 120).verdict,
        LookupVerdict::Listed
    );
    assert_eq!(
        cache.lookup("https://malware.test/other", 120).verdict,
        LookupVerdict::NotListed
    );
    assert_eq!(
        cache.lookup("https://malware.test/payload", 160).verdict,
        LookupVerdict::Stale
    );
    assert_eq!(
        cache
            .lookup("https://malware.test/payload", 120)
            .provider
            .as_deref(),
        Some("urlhaus")
    );
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn corrupt_and_interrupted_replacement_preserve_last_good_snapshot() {
    let dir = directory("replace");
    let _ = std::fs::remove_dir_all(&dir);
    let old = UrlhausFeed::parse(b"https://malware.test/old\n", 100, 60).unwrap();
    Cache::open(&dir).unwrap().activate(&old).unwrap();
    std::fs::write(
        dir.join("snapshot-99999999999999999999999999999999999999.json"),
        b"partial",
    )
    .unwrap();
    let mut cache = Cache::open(&dir).unwrap();
    assert_eq!(
        cache.lookup("https://malware.test/old", 120).verdict,
        LookupVerdict::Listed
    );
    let new = UrlhausFeed::parse(b"https://malware.test/new\n", 110, 60).unwrap();
    cache.activate(&new).unwrap();
    assert_eq!(
        cache.lookup("https://malware.test/new", 120).verdict,
        LookupVerdict::Listed
    );
    let marker = std::fs::read_dir(&dir)
        .unwrap()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "ready"))
        .max()
        .unwrap();
    std::fs::write(marker, b"bad digest").unwrap();
    let reopened = Cache::open(&dir).unwrap();
    assert_eq!(
        reopened.lookup("https://malware.test/old", 120).verdict,
        LookupVerdict::Listed
    );
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn missing_cache_is_unavailable_and_older_feed_cannot_replace_active() {
    let dir = directory("stale-candidate");
    let _ = std::fs::remove_dir_all(&dir);
    let mut cache = Cache::open(&dir).unwrap();
    assert_eq!(
        cache.lookup("https://malware.test/payload", 120).verdict,
        LookupVerdict::Unavailable
    );
    let current = UrlhausFeed::parse(b"https://malware.test/current\n", 110, 60).unwrap();
    let older = UrlhausFeed::parse(b"https://malware.test/older\n", 100, 60).unwrap();
    cache.activate(&current).unwrap();
    assert_eq!(
        cache.activate(&older),
        Err(sentinel_intel::cache::CacheError::StaleCandidate)
    );
    assert_eq!(
        cache.lookup("https://malware.test/current", 120).verdict,
        LookupVerdict::Listed
    );
    std::fs::remove_dir_all(dir).unwrap();
}
