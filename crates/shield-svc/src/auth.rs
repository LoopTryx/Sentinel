use shield_proto::rpc::RpcMethod;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Endpoint {
    User,
    Admin,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AuthError {
    RemoteClient,
    InvalidIdentity,
    WrongIdentity,
    ElevationRequired,
    ForbiddenMethod,
}

pub struct ServerBinding {
    sid: String,
    session_id: u32,
}

impl ServerBinding {
    pub fn new(sid: &str, session_id: u32) -> Self {
        Self {
            sid: sid.into(),
            session_id,
        }
    }
}

pub struct VerifiedCaller {
    sid: String,
    session_id: u32,
    elevated: bool,
    remote: bool,
}

impl VerifiedCaller {
    // Production construction must come from the connected pipe client's OS token.
    #[cfg(test)]
    fn from_os_token(sid: &str, session_id: u32, elevated: bool, remote: bool) -> Self {
        Self {
            sid: sid.into(),
            session_id,
            elevated,
            remote,
        }
    }

    #[cfg(windows)]
    pub(crate) fn from_os_identity(identity: crate::windows::OsIdentity) -> Self {
        Self {
            sid: identity.sid,
            session_id: identity.session_id,
            elevated: identity.elevated,
            remote: false,
        }
    }
}

pub fn authorize(
    endpoint: Endpoint,
    binding: &ServerBinding,
    caller: &VerifiedCaller,
    method: RpcMethod,
) -> Result<(), AuthError> {
    if caller.remote {
        return Err(AuthError::RemoteClient);
    }
    if caller.sid.is_empty()
        || caller.session_id == 0
        || binding.sid.is_empty()
        || binding.session_id == 0
    {
        return Err(AuthError::InvalidIdentity);
    }
    if caller.sid != binding.sid || caller.session_id != binding.session_id {
        return Err(AuthError::WrongIdentity);
    }
    match endpoint {
        Endpoint::User => {
            if matches!(
                method,
                RpcMethod::CapabilitiesList
                    | RpcMethod::ScanStart
                    | RpcMethod::JobsGet
                    | RpcMethod::JobsCancel
                    | RpcMethod::AssessmentGet
                    | RpcMethod::UsbList
                    | RpcMethod::WifiAssess
                    | RpcMethod::AwarenessNext
                    | RpcMethod::UrlAssess
            ) {
                Ok(())
            } else {
                Err(AuthError::ForbiddenMethod)
            }
        }
        Endpoint::Admin => {
            if !caller.elevated {
                return Err(AuthError::ElevationRequired);
            }
            if matches!(
                method,
                RpcMethod::UsbPolicyPreview
                    | RpcMethod::UsbPolicyApply
                    | RpcMethod::UsbPolicyRevert
            ) {
                Ok(())
            } else {
                Err(AuthError::ForbiddenMethod)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use shield_proto::rpc::RpcMethod;

    fn binding() -> ServerBinding {
        ServerBinding::new("S-1-5-21-owner", 7)
    }

    fn caller(elevated: bool) -> VerifiedCaller {
        VerifiedCaller::from_os_token("S-1-5-21-owner", 7, elevated, false)
    }

    #[test]
    fn user_endpoint_allows_reads_but_denies_admin_and_vault_methods() {
        assert_eq!(
            authorize(
                Endpoint::User,
                &binding(),
                &caller(false),
                RpcMethod::CapabilitiesList
            ),
            Ok(())
        );
        assert_eq!(
            authorize(
                Endpoint::User,
                &binding(),
                &caller(false),
                RpcMethod::UsbPolicyApply
            ),
            Err(AuthError::ForbiddenMethod)
        );
        assert_eq!(
            authorize(
                Endpoint::User,
                &binding(),
                &caller(false),
                RpcMethod::VaultFill
            ),
            Err(AuthError::ForbiddenMethod)
        );
    }

    #[test]
    fn admin_endpoint_requires_elevation_and_exact_user_session() {
        assert_eq!(
            authorize(
                Endpoint::Admin,
                &binding(),
                &caller(false),
                RpcMethod::UsbPolicyApply
            ),
            Err(AuthError::ElevationRequired)
        );
        assert_eq!(
            authorize(
                Endpoint::Admin,
                &binding(),
                &caller(true),
                RpcMethod::UsbPolicyApply
            ),
            Ok(())
        );
        let wrong_sid = VerifiedCaller::from_os_token("S-1-5-21-other", 7, true, false);
        assert_eq!(
            authorize(
                Endpoint::Admin,
                &binding(),
                &wrong_sid,
                RpcMethod::UsbPolicyApply
            ),
            Err(AuthError::WrongIdentity)
        );
        let wrong_session = VerifiedCaller::from_os_token("S-1-5-21-owner", 8, true, false);
        assert_eq!(
            authorize(
                Endpoint::Admin,
                &binding(),
                &wrong_session,
                RpcMethod::UsbPolicyApply
            ),
            Err(AuthError::WrongIdentity)
        );
    }

    #[test]
    fn remote_and_invalid_identity_are_rejected_before_method_dispatch() {
        let remote = VerifiedCaller::from_os_token("S-1-5-21-owner", 7, true, true);
        assert_eq!(
            authorize(
                Endpoint::Admin,
                &binding(),
                &remote,
                RpcMethod::UsbPolicyApply
            ),
            Err(AuthError::RemoteClient)
        );
        let no_sid = VerifiedCaller::from_os_token("", 7, false, false);
        assert_eq!(
            authorize(
                Endpoint::User,
                &binding(),
                &no_sid,
                RpcMethod::CapabilitiesList
            ),
            Err(AuthError::InvalidIdentity)
        );
    }
}
