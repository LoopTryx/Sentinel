use sentinel_core::config::Config;

#[test]
fn safe_defaults_do_not_enable_mutations_or_providers() {
    let config = Config::default();
    assert!(!config.provider_requests_enabled);
    assert!(!config.usb_policy_enabled);
    assert_eq!(config.activity_retention_days, 30);
}

#[test]
fn invalid_retention_is_rejected() {
    let config = Config {
        activity_retention_days: 0,
        ..Config::default()
    };
    assert!(config.validate().is_err());
}
