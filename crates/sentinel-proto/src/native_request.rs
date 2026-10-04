//! Parse-only native v1 allowlist. No caller authentication or dispatch.
use serde::Deserialize;
use serde_json::{Value, value::RawValue};
#[derive(Debug, PartialEq, Eq)]
pub enum NativeRequestErrorCode {
    BadRequest,
    Oversized,
    UnsupportedMethod,
    UnsupportedVersion,
}
#[derive(Debug)]
pub struct NativeRequestError {
    pub code: NativeRequestErrorCode,
    pub id: Option<String>,
}
pub enum NativeRequest {
    Capabilities {
        id: String,
    },
    Url {
        id: String,
        subject_ref: String,
        url: String,
    },
}
impl std::fmt::Debug for NativeRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("validated native request (payload redacted)")
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Version {
    major: u16,
    minor: u16,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    version: Version,
    id: String,
    kind: String,
    payload: Box<RawValue>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct UrlPayload {
    url: String,
    subject_ref: String,
}
fn reference(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 128
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
fn error(code: NativeRequestErrorCode, id: Option<String>) -> NativeRequestError {
    NativeRequestError { code, id }
}
pub fn validate_request(bytes: &[u8]) -> Result<NativeRequest, NativeRequestError> {
    if bytes.len() > crate::rpc::MAX_MESSAGE_BYTES {
        return Err(error(NativeRequestErrorCode::Oversized, None));
    }
    let bad = || error(NativeRequestErrorCode::BadRequest, None);
    let envelope: Envelope = serde_json::from_slice(bytes).map_err(|_| bad())?;
    if !reference(&envelope.id)
        || envelope.kind.is_empty()
        || envelope.kind.len() > 128
        || !serde_json::from_str::<Value>(envelope.payload.get()).is_ok_and(|p| p.is_object())
    {
        return Err(bad());
    }
    let request = match envelope.kind.as_str() {
        "capabilities.list" => {
            if !serde_json::from_str::<Value>(envelope.payload.get())
                .is_ok_and(|p| p.as_object().is_some_and(|p| p.is_empty()))
            {
                return Err(bad());
            }
            NativeRequest::Capabilities {
                id: envelope.id.clone(),
            }
        }
        "url.assess" => {
            let p: UrlPayload = serde_json::from_str(envelope.payload.get()).map_err(|_| bad())?;
            if !reference(&p.subject_ref)
                || p.url.len() > 8192
                || p.url.chars().count() > 2048
                || p.url.chars().any(|c| c.is_control() || c.is_whitespace())
                || p.url.contains('\\')
            {
                return Err(bad());
            }
            let (scheme, rest) = p.url.split_once("://").ok_or_else(bad)?;
            if !scheme.eq_ignore_ascii_case("http") && !scheme.eq_ignore_ascii_case("https") {
                return Err(bad());
            }
            let authority = rest.split(['/', '?', '#']).next().unwrap_or_default();
            if authority.is_empty() || authority.contains('@') {
                return Err(bad());
            }
            let parsed = url::Url::parse(&p.url).map_err(|_| bad())?;
            if parsed.host_str().is_none()
                || !parsed.username().is_empty()
                || parsed.password().is_some()
            {
                return Err(bad());
            }
            NativeRequest::Url {
                id: envelope.id.clone(),
                subject_ref: p.subject_ref,
                url: p.url,
            }
        }
        _ => {
            let code = if envelope.version.major != 1 || envelope.version.minor != 0 {
                NativeRequestErrorCode::UnsupportedVersion
            } else {
                NativeRequestErrorCode::UnsupportedMethod
            };
            return Err(error(code, Some(envelope.id)));
        }
    };
    if envelope.version.major != 1 || envelope.version.minor != 0 {
        return Err(error(
            NativeRequestErrorCode::UnsupportedVersion,
            Some(envelope.id),
        ));
    }
    Ok(request)
}
