use crate::auth::{Endpoint, ServerBinding, VerifiedCaller, authorize};
use crate::windows::OsIdentity;
use serde::Deserialize;
use shield_proto::rpc::{MAX_MESSAGE_BYTES, ProtocolVersion, RpcMethod, encode_frame};
use shield_proto::status::StatusSnapshot;
use std::fs::File;
use std::io::{self, Read, Write};
use std::mem::size_of;
use std::os::windows::io::{AsRawHandle, FromRawHandle};
use std::ptr::{null, null_mut};
use windows_sys::Win32::Foundation::{ERROR_PIPE_CONNECTED, INVALID_HANDLE_VALUE, LocalFree};
use windows_sys::Win32::Security::Authorization::{
    ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
};
use windows_sys::Win32::Security::{PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, FILE_FLAG_FIRST_PIPE_INSTANCE, FILE_READ_DATA, FILE_WRITE_DATA, OPEN_EXISTING,
    PIPE_ACCESS_DUPLEX, SYNCHRONIZE,
};
use windows_sys::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS,
    PIPE_TYPE_BYTE, PIPE_WAIT,
};

struct OwnedSecurityDescriptor(PSECURITY_DESCRIPTOR);

impl Drop for OwnedSecurityDescriptor {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: ConvertStringSecurityDescriptorToSecurityDescriptorW allocated this value.
            unsafe { LocalFree(self.0.cast()) };
        }
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct FixtureRequest {
    version: ProtocolVersion,
    method: RpcMethod,
}

pub struct LocalFixturePipe {
    file: File,
    binding: ServerBinding,
}

impl LocalFixturePipe {
    pub fn bind(name: &str) -> io::Result<Self> {
        validate_fixture_name(name)?;
        let identity = OsIdentity::current_process()?;
        // Generic write would include FILE_CREATE_PIPE_INSTANCE. Clients receive
        // only read/write data and synchronize rights.
        let sddl = format!("D:P(A;;GA;;;SY)(A;;0x0012019B;;;{})", identity.sid);
        let sddl_wide: Vec<u16> = sddl.encode_utf16().chain(std::iter::once(0)).collect();
        let mut raw_descriptor: PSECURITY_DESCRIPTOR = null_mut();
        // SAFETY: The SDDL is null terminated and the output pointer is valid.
        if unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl_wide.as_ptr(),
                SDDL_REVISION_1,
                &mut raw_descriptor,
                null_mut(),
            )
        } == 0
        {
            return Err(io::Error::last_os_error());
        }
        let descriptor = OwnedSecurityDescriptor(raw_descriptor);
        let attributes = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor.0,
            bInheritHandle: 0,
        };
        let name_wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
        // SAFETY: The name and security attributes are valid for the duration of this call.
        let handle = unsafe {
            CreateNamedPipeW(
                name_wide.as_ptr(),
                PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                2,
                65_536,
                65_536,
                5_000,
                &attributes,
            )
        };
        if handle == INVALID_HANDLE_VALUE {
            return Err(io::Error::last_os_error());
        }
        // SAFETY: CreateNamedPipeW returned a new owned handle. File closes it on drop.
        let file = unsafe { File::from_raw_handle(handle) };
        Ok(Self {
            file,
            binding: ServerBinding::new(&identity.sid, identity.session_id),
        })
    }

    pub fn serve_once(mut self) -> io::Result<()> {
        // SAFETY: The file owns a valid named-pipe server handle; null means synchronous mode.
        if unsafe { ConnectNamedPipe(self.file.as_raw_handle(), null_mut()) } == 0 {
            let error = io::Error::last_os_error();
            if error.raw_os_error() != Some(ERROR_PIPE_CONNECTED as i32) {
                return Err(error);
            }
        }
        let mut header = [0u8; 4];
        self.file.read_exact(&mut header)?;
        let length = u32::from_be_bytes(header) as usize;
        if length > MAX_MESSAGE_BYTES {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "oversized frame",
            ));
        }
        let mut payload = vec![0u8; length];
        self.file.read_exact(&mut payload)?;
        let request: FixtureRequest = serde_json::from_slice(&payload)
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid request"))?;
        ProtocolVersion::new(1, 0)
            .negotiate(request.version)
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "unsupported protocol"))?;
        let caller = VerifiedCaller::from_os_identity(OsIdentity::from_pipe_client(
            self.file.as_raw_handle(),
        )?);
        authorize(Endpoint::User, &self.binding, &caller, request.method)
            .map_err(|_| io::Error::new(io::ErrorKind::PermissionDenied, "unauthorized method"))?;
        if request.method != RpcMethod::CapabilitiesList {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "fixture method unavailable",
            ));
        }
        let fixture: StatusSnapshot =
            serde_json::from_str(include_str!("../../../data/fixtures/status.json"))
                .expect("checked-in fixture must match contracts");
        let response = serde_json::to_vec(
            &serde_json::json!({"mode":"fixture", "capabilities": fixture.capabilities}),
        )
        .expect("fixture response must serialize");
        let frame = encode_frame(&response)
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "oversized response"))?;
        self.file.write_all(&frame)
    }
}

pub fn connect_fixture(name: &str) -> io::Result<File> {
    validate_fixture_name(name)?;
    let name_wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
    // SAFETY: The path is null terminated; requested rights exclude creating pipe instances.
    let handle = unsafe {
        CreateFileW(
            name_wide.as_ptr(),
            FILE_READ_DATA | FILE_WRITE_DATA | SYNCHRONIZE,
            0,
            null(),
            OPEN_EXISTING,
            0,
            null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: CreateFileW returned an owned handle; File closes it on drop.
    Ok(unsafe { File::from_raw_handle(handle) })
}

fn validate_fixture_name(name: &str) -> io::Result<()> {
    let suffix = name
        .strip_prefix(r"\\.\pipe\CyberShield-v3-fixture-")
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "invalid fixture pipe name"))?;
    if suffix.is_empty()
        || !suffix
            .bytes()
            .all(|byte| byte.is_ascii_digit() || byte == b'-')
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "invalid fixture pipe name",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn local_pipe_uses_client_token_for_fixture_capabilities() {
        let identity = crate::windows::OsIdentity::current_process().unwrap();
        if identity.session_id == 0 {
            return;
        }
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let name = format!(
            r"\\.\pipe\CyberShield-v3-fixture-{}-{unique}",
            std::process::id()
        );
        let server = LocalFixturePipe::bind(&name).unwrap();
        let thread = std::thread::spawn(move || server.serve_once());
        let mut client = connect_fixture(&name).unwrap();
        let request = br#"{"version":{"major":1,"minor":0},"method":"capabilities.list"}"#;
        client
            .write_all(&shield_proto::rpc::encode_frame(request).unwrap())
            .unwrap();
        let mut header = [0u8; 4];
        client.read_exact(&mut header).unwrap();
        let mut payload = vec![0u8; u32::from_be_bytes(header) as usize];
        client.read_exact(&mut payload).unwrap();
        let response: serde_json::Value = serde_json::from_slice(&payload).unwrap();
        assert_eq!(response["capabilities"][0]["state"], "unavailable");
        assert!(thread.join().unwrap().is_ok());
    }

    #[test]
    fn user_pipe_rejects_admin_method_and_request_supplied_identity() {
        let identity = crate::windows::OsIdentity::current_process().unwrap();
        if identity.session_id == 0 {
            return;
        }
        for (index, request, expected) in [
            (0, br#"{"version":{"major":1,"minor":0},"method":"usb.policy.apply"}"#.as_slice(), io::ErrorKind::PermissionDenied),
            (1, br#"{"version":{"major":1,"minor":0},"method":"capabilities.list","sid":"S-1-5-18"}"#.as_slice(), io::ErrorKind::InvalidData),
        ] {
            let name = format!(r"\\.\pipe\CyberShield-v3-fixture-{}-{index}", std::process::id());
            let server = LocalFixturePipe::bind(&name).unwrap();
            let thread = std::thread::spawn(move || server.serve_once());
            let mut client = connect_fixture(&name).unwrap();
            client.write_all(&shield_proto::rpc::encode_frame(request).unwrap()).unwrap();
            let actual = thread.join().unwrap().unwrap_err().kind();
            drop(client);
            assert_eq!(actual, expected);
        }
    }

    #[test]
    fn local_pipe_rejects_oversized_frame_before_allocating_payload() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let name = format!(
            r"\\.\pipe\CyberShield-v3-fixture-{}-{unique}",
            std::process::id()
        );
        let server = LocalFixturePipe::bind(&name).unwrap();
        let thread = std::thread::spawn(move || server.serve_once());
        let mut client = connect_fixture(&name).unwrap();
        client
            .write_all(&((MAX_MESSAGE_BYTES + 1) as u32).to_be_bytes())
            .unwrap();
        let result = thread.join().unwrap();
        assert_eq!(result.unwrap_err().kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn client_rights_cannot_create_a_second_server_instance() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let name = format!(
            r"\\.\pipe\CyberShield-v3-fixture-{}-{unique}",
            std::process::id()
        );
        let _server = LocalFixturePipe::bind(&name).unwrap();
        let name_wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
        // SAFETY: The path is null terminated; this probes whether the DACL denies
        // FILE_CREATE_PIPE_INSTANCE to a same-user second server.
        let handle = unsafe {
            CreateNamedPipeW(
                name_wide.as_ptr(),
                PIPE_ACCESS_DUPLEX,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                2,
                65_536,
                65_536,
                5_000,
                null(),
            )
        };
        assert_eq!(handle, INVALID_HANDLE_VALUE);
        assert_eq!(
            io::Error::last_os_error().kind(),
            io::ErrorKind::PermissionDenied
        );
    }
}
