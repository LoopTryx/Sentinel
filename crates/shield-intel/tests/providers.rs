use shield_intel::providers::{FeedError, MAX_FEED_BYTES, UrlhausFeed};

#[test]
fn benign_fixture_is_parsed_and_deduplicated() {
    let feed = UrlhausFeed::parse(
        include_bytes!("../../../data/fixtures/feeds/urlhaus-sample.txt"),
        100,
        60,
    )
    .unwrap();
    assert_eq!(feed.urls.len(), 2);
    assert_eq!(feed.retrieved_at, 100);
    assert_eq!(feed.expires_at, 160);
    assert_eq!(feed.provider, "urlhaus");
    assert!(
        feed.urls
            .contains(&"https://malware.test/payload.exe".to_string())
    );
}

#[test]
fn malformed_oversized_and_empty_feeds_are_rejected() {
    assert_eq!(
        UrlhausFeed::parse(b"file:///etc/passwd\n", 100, 60),
        Err(FeedError::InvalidUrl)
    );
    assert_eq!(
        UrlhausFeed::parse(b"https://user:pass@danger.test/\n", 100, 60),
        Err(FeedError::InvalidUrl)
    );
    assert_eq!(UrlhausFeed::parse(b"\n", 100, 60), Err(FeedError::Empty));
    assert_eq!(
        UrlhausFeed::parse(&vec![b'a'; MAX_FEED_BYTES + 1], 100, 60),
        Err(FeedError::Oversized)
    );
    assert_eq!(
        UrlhausFeed::parse(b"https://malware.test/\n", 100, 0),
        Err(FeedError::InvalidExpiry)
    );
}
