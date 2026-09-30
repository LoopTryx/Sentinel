use sentinel_intel::cache::{Cache, LookupVerdict};
use sentinel_intel::providers::UrlhausFeed;
use std::path::PathBuf;

fn directory(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!("sentinel-intel-{label}-{}", std::process::id()))
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
