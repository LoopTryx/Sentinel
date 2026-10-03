use crate::providers::MAX_URL_BYTES;
use sentinel_proto::assessment::{Confidence, Coverage, Risk};
use sentinel_proto::url_explanation::{UrlExplanation, UrlExplanationError, UrlReason};
use url::{Host, Url};

/// Parse and explain at most 2,048 UTF-8 bytes. Never fetches or opens the URL.
/// This function neither consults reputation nor computes a registrable domain.
pub fn explain_url(input: &str) -> Result<UrlExplanation, UrlExplanationError> {
    if input.len() > MAX_URL_BYTES {
        return Err(UrlExplanationError::TooLong);
    }
    if input.chars().any(|c| {
        c.is_control()
            || c.is_whitespace()
            || c == '\\'
            || matches!(c, '\u{200b}' | '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}' | '\u{feff}')
    }) {
        return Err(UrlExplanationError::AmbiguousInput);
    }
    let (scheme, remaining) = input
        .split_once("://")
        .ok_or(UrlExplanationError::InvalidUrl)?;
    if !scheme.eq_ignore_ascii_case("https") && !scheme.eq_ignore_ascii_case("http") {
        return Err(UrlExplanationError::UnsupportedScheme);
    }
    let authority = remaining.split(['/', '?', '#']).next().unwrap_or_default();
    if authority.is_empty() {
        return Err(UrlExplanationError::InvalidUrl);
    }
    let parsed = Url::parse(input).map_err(|_| UrlExplanationError::InvalidUrl)?;
    let host = parsed.host().ok_or(UrlExplanationError::InvalidUrl)?;
    let mut reasons = Vec::new();
    if authority.contains('@') {
        reasons.push(UrlReason::EmbeddedCredentials);
    }
    if parsed.scheme() == "http" {
        reasons.push(UrlReason::UnencryptedHttp);
    }
    match host {
        Host::Ipv4(_) | Host::Ipv6(_) => reasons.push(UrlReason::IpLiteral),
        Host::Domain(domain) if domain.split('.').any(|part| part.starts_with("xn--")) => {
            reasons.push(UrlReason::InternationalizedHost);
        }
        _ => {}
    }
    if parsed.port().is_some() {
        reasons.push(UrlReason::UnusualPort);
    }
    Ok(UrlExplanation {
        schema_version: 1,
        host_ascii: host.to_string(),
        scheme: parsed.scheme().to_owned(),
        port: parsed
            .port_or_known_default()
            .ok_or(UrlExplanationError::InvalidUrl)?,
        registrable_domain: None,
        risk: if reasons.is_empty() {
            Risk::Unknown
        } else {
            Risk::Suspicious
        },
        confidence: Confidence::Low,
        coverage: Coverage::Partial,
        reasons,
        network_accessed: false,
        reputation_checked: false,
    })
}
