pub const REDACTED: &str = "[redacted]";

/// Use at diagnostic boundaries for paths, URLs, account names, network identifiers,
/// and device serials until a typed, keyed-pseudonym format is available.
pub fn redact_diagnostic(_value: &str) -> &'static str {
    REDACTED
}
