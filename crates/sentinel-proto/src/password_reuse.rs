//! Local exact-reuse audit. Secret inputs are borrowed and never part of a DTO.
use serde::Serialize;
use ts_rs::TS;

pub const MAX_REUSE_AUDIT_ITEMS: usize = 128;
pub const MAX_REUSE_PASSWORD_BYTES: usize = 1024;

#[derive(Debug, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct PasswordReuseAudit {
    pub checked_items: u16,
    /// Input indices grouped only when an exact password occurs at least twice.
    /// Unique items are omitted; uniqueness is not a strength or safety verdict.
    pub reused_groups: Vec<Vec<u16>>,
}

#[derive(Debug, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum PasswordReuseAuditError {
    TooManyItems,
    EmptyPassword,
    PasswordTooLong,
}

/// Compare a complete, bounded batch inside the future reviewed vault owner.
/// This does not authorize access, retain/hash/log secrets or audit across batches.
/// The caller owns secret buffers, zeroization and session/record-version binding.
pub fn audit_password_reuse(
    passwords: &[&str],
) -> Result<PasswordReuseAudit, PasswordReuseAuditError> {
    if passwords.len() > MAX_REUSE_AUDIT_ITEMS {
        return Err(PasswordReuseAuditError::TooManyItems);
    }
    // Validate the whole batch before comparing or constructing any result.
    for password in passwords {
        if password.is_empty() {
            return Err(PasswordReuseAuditError::EmptyPassword);
        }
        if password.len() > MAX_REUSE_PASSWORD_BYTES {
            return Err(PasswordReuseAuditError::PasswordTooLong);
        }
    }
    let mut grouped = [false; MAX_REUSE_AUDIT_ITEMS];
    let mut reused_groups = Vec::new();
    for (i, password) in passwords.iter().enumerate() {
        if grouped[i] {
            continue;
        }
        let mut group = Vec::new();
        for j in i + 1..passwords.len() {
            if password == &passwords[j] {
                if group.is_empty() {
                    group.push(i as u16);
                }
                group.push(j as u16);
                grouped[j] = true;
            }
        }
        if !group.is_empty() {
            reused_groups.push(group);
        }
    }
    Ok(PasswordReuseAudit {
        checked_items: passwords.len() as u16,
        reused_groups,
    })
}
