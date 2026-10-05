use sentinel_proto::native_origin::{NativeOriginAllowlist, OriginConfigError};

fn id() -> String {
    "a".repeat(32)
}
fn origin() -> String {
    format!("chrome-extension://{}/", id())
}

#[test]
fn explicit_registered_origin_only() {
    let list = NativeOriginAllowlist::new(vec![id()]).unwrap();
    assert!(list.allows(&origin()));
    assert!(!list.allows(&format!("chrome-extension://{}/", "b".repeat(32))));
}

#[test]
fn rejects_url_normalization_and_origin_impostors() {
    let list = NativeOriginAllowlist::new(vec![id()]).unwrap();
    for input in [
        format!("CHROME-EXTENSION://{}/", id()),
        format!("chrome-extension://{}/", "A".repeat(32)),
        format!("chrome-extension://{}", id()),
        format!("chrome-extension://{}.evil/", id()),
        format!("chrome-extension://{}:80/", id()),
        format!("chrome-extension://user@{}/", id()),
        format!("chrome-extension://{}/page", id()),
        format!("chrome-extension://{}//", id()),
        format!("chrome-extension://{}/?q=1", id()),
        format!("chrome-extension://{}/#fragment", id()),
        format!("chrome-extension://{}./", id()),
        format!("chrome-extension://%61{}/", "a".repeat(31)),
        format!(" chrome-extension://{}/", id()),
        format!("chrome-extension://{}/\0", id()),
        format!("https://{}/", id()),
        format!("chrome-extension://{}/", "а".repeat(32)),
        "*".to_string(),
        "x".repeat(1024 * 1024),
    ] {
        assert!(!list.allows(&input));
    }
}

#[test]
fn rejects_invalid_or_ambiguous_configuration() {
    assert_eq!(
        NativeOriginAllowlist::new(vec![]).unwrap_err(),
        OriginConfigError::Empty
    );
    assert_eq!(
        NativeOriginAllowlist::new(vec![id(); 5]).unwrap_err(),
        OriginConfigError::TooMany
    );
    assert_eq!(
        NativeOriginAllowlist::new(vec![id(), id()]).unwrap_err(),
        OriginConfigError::DuplicateId
    );
    for bad in [
        "a".repeat(31),
        "a".repeat(33),
        "q".repeat(32),
        "A".repeat(32),
        origin(),
        "*".to_string(),
    ] {
        assert_eq!(
            NativeOriginAllowlist::new(vec![bad]).unwrap_err(),
            OriginConfigError::InvalidId
        );
    }
}

#[test]
fn accepts_four_distinct_ids_and_redacts_debug() {
    let ids: Vec<String> = ['a', 'b', 'c', 'p']
        .iter()
        .map(|c| c.to_string().repeat(32))
        .collect();
    let list = NativeOriginAllowlist::new(ids.clone()).unwrap();
    for registered in ids {
        assert!(list.allows(&format!("chrome-extension://{registered}/")));
        assert!(!format!("{list:?}").contains(&registered));
    }
}
