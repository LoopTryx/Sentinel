//! Bounded, token-authenticated user-session transport. No fixture dispatch.
use crate::windows::OsIdentity;
use sentinel_proto::rpc::{MAX_MESSAGE_BYTES, encode_frame};
use std::fs::File;
use std::io;
use std::mem::{size_of, zeroed};
use std::os::windows::io::{AsRawHandle, FromRawHandle};
use std::ptr::{null, null_mut};
use std::time::{Duration, Instant};
use windows_sys::Win32::Foundation::{
    CloseHandle, ERROR_IO_INCOMPLETE, ERROR_IO_PENDING, ERROR_PIPE_CONNECTED, HANDLE,
    INVALID_HANDLE_VALUE, LocalFree, WAIT_OBJECT_0, WAIT_TIMEOUT,
};
use windows_sys::Win32::Security::Authorization::{
    ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
};
use windows_sys::Win32::Security::{PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES, TOKEN_QUERY};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, FILE_FLAG_FIRST_PIPE_INSTANCE, FILE_FLAG_OVERLAPPED, FILE_READ_DATA,
    FILE_WRITE_DATA, OPEN_EXISTING, PIPE_ACCESS_DUPLEX, ReadFile, SECURITY_IDENTIFICATION,
    SECURITY_SQOS_PRESENT, SYNCHRONIZE, WriteFile,
};
use windows_sys::Win32::System::IO::{
    CancelIoEx, GetOverlappedResult, GetOverlappedResultEx, OVERLAPPED,
};
use windows_sys::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, GetNamedPipeServerProcessId, PIPE_READMODE_BYTE,
    PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_BYTE, PIPE_WAIT,
};
use windows_sys::Win32::System::Threading::{
    CreateEventW, OpenProcess, OpenProcessToken, PROCESS_QUERY_LIMITED_INFORMATION,
    WaitForSingleObject,
};

pub struct AuthenticatedPipe {
    file: File,
    identity: OsIdentity,
    connected: bool,
    authenticated: bool,
}

// Private fields prevent callers from manufacturing an authenticated request.
// No Debug implementation: arbitrary request bodies must not enter diagnostics.
pub struct AuthenticatedRequest {
    owner_ref: String,
    payload: Vec<u8>,
}
impl AuthenticatedRequest {
    pub fn owner_ref(&self) -> &str {
        &self.owner_ref
    }
    pub fn payload(&self) -> &[u8] {
        &self.payload
    }
}

struct Descriptor(PSECURITY_DESCRIPTOR);
impl Drop for Descriptor {
    fn drop(&mut self) {
        unsafe {
            LocalFree(self.0.cast());
        }
    }
}
struct Event(HANDLE);
impl Drop for Event {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

impl AuthenticatedPipe {
    pub fn bind(name: &str) -> io::Result<Self> {
        validate_name(name)?;
        let identity = OsIdentity::current_process()?;
        if identity.session_id == 0 {
            return Err(io::ErrorKind::PermissionDenied.into());
        }
        let logon_sid = OsIdentity::current_logon_sid()?;
        let sddl: Vec<u16> = format!("D:P(A;;GA;;;SY)(A;;0x0012019B;;;{logon_sid})")
            .encode_utf16()
            .chain([0])
            .collect();
        let mut descriptor = null_mut();
        // SAFETY: null-terminated SDDL and valid output pointer; LocalFree on drop.
        if unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(),
                SDDL_REVISION_1,
                &mut descriptor,
                null_mut(),
            )
        } == 0
        {
            return Err(io::Error::last_os_error());
        }
        let descriptor = Descriptor(descriptor);
        let security = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor.0,
            bInheritHandle: 0,
        };
        let wide: Vec<u16> = name.encode_utf16().chain([0]).collect();
        // SAFETY: valid pointers; one non-inheritable local-only overlapped instance.
        let handle = unsafe {
            CreateNamedPipeW(
                wide.as_ptr(),
                PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE | FILE_FLAG_OVERLAPPED,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                1,
                65536,
                65536,
                5000,
                &security,
            )
        };
        if handle == INVALID_HANDLE_VALUE {
            return Err(io::Error::last_os_error());
        }
        // SAFETY: new handle exclusively owned by this File.
        let file = unsafe { File::from_raw_handle(handle) };
        Ok(Self {
            file,
            identity,
            connected: false,
            authenticated: false,
        })
    }

    pub fn receive(&mut self, timeout: Duration) -> io::Result<AuthenticatedRequest> {
        let deadline = deadline(timeout)?;
        self.authenticated = false;
        if !self.connected {
            let handle = self.file.as_raw_handle();
            operation(handle, remaining(deadline)?, true, |overlapped, _| {
                // SAFETY: live pipe and pinned operation storage until completion.
                unsafe { ConnectNamedPipe(handle, overlapped) }
            })?;
            self.connected = true;
        }
        let mut header = [0; 4];
        self.read_exact(&mut header, deadline)?;
        let length = u32::from_be_bytes(header) as usize;
        if length > MAX_MESSAGE_BYTES {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "oversized frame",
            ));
        }
        let mut payload = vec![0; length];
        self.read_exact(&mut payload, deadline)?;
        let actual = OsIdentity::from_pipe_client(self.file.as_raw_handle())?;
        if actual.sid != self.identity.sid
            || actual.session_id != self.identity.session_id
            || actual.session_id == 0
        {
            return Err(io::ErrorKind::PermissionDenied.into());
        }
        self.authenticated = true;
        Ok(AuthenticatedRequest {
            owner_ref: format!("{}:{}", actual.sid, actual.session_id),
            payload,
        })
    }

    fn read_exact(&self, mut bytes: &mut [u8], deadline: Instant) -> io::Result<()> {
        while !bytes.is_empty() {
            let handle = self.file.as_raw_handle();
            let count = operation(handle, remaining(deadline)?, false, |overlapped, count| {
                // SAFETY: buffer remains alive/exclusively borrowed until completion/cancellation.
                unsafe {
                    ReadFile(
                        handle,
                        bytes.as_mut_ptr(),
                        bytes.len() as u32,
                        count,
                        overlapped,
                    )
                }
            })? as usize;
            if count == 0 {
                return Err(io::ErrorKind::UnexpectedEof.into());
            }
            bytes = &mut bytes[count..];
        }
        Ok(())
    }

    pub fn reply(&mut self, payload: &[u8], timeout: Duration) -> io::Result<()> {
        if !self.authenticated {
            return Err(io::ErrorKind::PermissionDenied.into());
        }
        self.authenticated = false; // A failed/partial send cannot be retried as another reply.
        let deadline = deadline(timeout)?;
        let frame = encode_frame(payload)
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "oversized response"))?;
        let mut bytes = frame.as_slice();
        while !bytes.is_empty() {
            let handle = self.file.as_raw_handle();
            let count = operation(handle, remaining(deadline)?, false, |overlapped, count| {
                // SAFETY: frame storage remains alive through completion/cancellation.
                unsafe {
                    WriteFile(
                        handle,
                        bytes.as_ptr(),
                        bytes.len() as u32,
                        count,
                        overlapped,
                    )
                }
            })? as usize;
            if count == 0 {
                return Err(io::ErrorKind::WriteZero.into());
            }
            bytes = &bytes[count..];
        }
        Ok(())
    }
}

fn deadline(timeout: Duration) -> io::Result<Instant> {
    if timeout.is_zero() || timeout > Duration::from_secs(30) {
        return Err(io::ErrorKind::InvalidInput.into());
    }
    Ok(Instant::now() + timeout)
}
fn remaining(deadline: Instant) -> io::Result<Duration> {
    deadline
        .checked_duration_since(Instant::now())
        .filter(|duration| !duration.is_zero())
        .ok_or_else(|| io::ErrorKind::TimedOut.into())
}

fn operation(
    handle: HANDLE,
    timeout: Duration,
    connect: bool,
    initiate: impl FnOnce(*mut OVERLAPPED, *mut u32) -> i32,
) -> io::Result<u32> {
    // SAFETY: unnamed manual-reset non-inheritable event; closed after I/O completes.
    let event = Event(unsafe { CreateEventW(null(), 1, 0, null()) });
    if event.0.is_null() {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: OVERLAPPED is a plain output structure; stack address is unchanged while pending.
    let mut overlapped: OVERLAPPED = unsafe { zeroed() };
    overlapped.hEvent = event.0;
    let mut count = 0;
    if initiate(&mut overlapped, &mut count) != 0 {
        return Ok(count);
    }
    let error = io::Error::last_os_error();
    if connect && error.raw_os_error() == Some(ERROR_PIPE_CONNECTED as i32) {
        return Ok(0);
    }
    if error.raw_os_error() != Some(ERROR_IO_PENDING as i32) {
        return Err(error);
    }
    // SAFETY: live event associated with this one pending operation.
    let wait = unsafe { WaitForSingleObject(event.0, timeout.as_millis().clamp(1, 30000) as u32) };
    if wait != WAIT_OBJECT_0 {
        // SAFETY: cancel only this operation, then wait for cancellation completion
        // before releasing OVERLAPPED or its borrowed buffer.
        unsafe {
            CancelIoEx(handle, &overlapped);
        }
        let completed = unsafe { GetOverlappedResultEx(handle, &overlapped, &mut count, 1000, 0) };
        let cleanup_error = io::Error::last_os_error();
        if completed == 0
            && matches!(cleanup_error.raw_os_error(), Some(code) if code == WAIT_TIMEOUT as i32 || code == ERROR_IO_INCOMPLETE as i32)
        {
            // Continuing would let Windows write through dead stack pointers.
            // Fail closed if the OS cannot finish a cancelled pipe operation.
            std::process::abort();
        }
        return Err(if wait == WAIT_TIMEOUT {
            io::ErrorKind::TimedOut.into()
        } else {
            io::Error::other("pipe event wait failed")
        });
    }
    // SAFETY: event signaled; retrieve completion status without another blocking wait.
    if unsafe { GetOverlappedResult(handle, &overlapped, &mut count, 0) } == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(count)
}

pub fn connect_user(name: &str) -> io::Result<File> {
    validate_name(name)?;
    let wide: Vec<u16> = name.encode_utf16().chain([0]).collect();
    // SAFETY: valid name; requested rights cannot create a server instance.
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            FILE_READ_DATA | FILE_WRITE_DATA | SYNCHRONIZE,
            0,
            null(),
            OPEN_EXISTING,
            SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION,
            null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error());
    }
    // Identity inspection is sufficient for server authorization. Do not grant
    // the server authority to execute operations as the connecting client.
    // SAFETY: newly owned client handle.
    let client = unsafe { File::from_raw_handle(handle) };
    verify_server(&client, &OsIdentity::current_process()?)?;
    Ok(client)
}

fn verify_server(client: &File, expected: &OsIdentity) -> io::Result<()> {
    let mut process_id = 0;
    // SAFETY: client owns a connected local pipe and the output pointer is valid.
    if unsafe { GetNamedPipeServerProcessId(client.as_raw_handle(), &mut process_id) } == 0 {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: query-only, non-inheritable process handle; Event owns/ closes HANDLEs.
    let process = Event(unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) });
    if process.0.is_null() {
        return Err(io::Error::last_os_error());
    }
    let mut raw_token = null_mut();
    // SAFETY: live process handle and valid token output pointer.
    if unsafe { OpenProcessToken(process.0, TOKEN_QUERY, &mut raw_token) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let token = Event(raw_token);
    let actual = OsIdentity::from_token(token.0)?;
    if expected.session_id == 0
        || actual.sid != expected.sid
        || actual.session_id != expected.session_id
    {
        return Err(io::ErrorKind::PermissionDenied.into());
    }
    Ok(())
}

fn validate_name(name: &str) -> io::Result<()> {
    let suffix = name
        .strip_prefix(r"\\.\pipe\Sentinel-v1-user-")
        .ok_or(io::ErrorKind::InvalidInput)?;
    if suffix.is_empty()
        || suffix.len() > 128
        || !suffix
            .bytes()
            .all(|byte| byte.is_ascii_digit() || byte == b'-')
    {
        return Err(io::ErrorKind::InvalidInput.into());
    }
    Ok(())
}

#[cfg(test)]
mod server_identity_tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn client_grants_identity_inspection_only() {
        use std::io::Write;
        use windows_sys::Win32::Security::{
            GetTokenInformation, RevertToSelf, SECURITY_IMPERSONATION_LEVEL,
            SecurityIdentification, TokenImpersonationLevel,
        };
        use windows_sys::Win32::System::Pipes::ImpersonateNamedPipeClient;
        use windows_sys::Win32::System::Threading::{GetCurrentThread, OpenThreadToken};
        struct Revert;
        impl Drop for Revert {
            fn drop(&mut self) {
                // SAFETY: test thread must never retain the client identity.
                if unsafe { RevertToSelf() } == 0 {
                    std::process::abort();
                }
            }
        }
        let name = format!(
            r"\\.\pipe\Sentinel-v1-user-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let mut pipe = AuthenticatedPipe::bind(&name).unwrap();
        let mut client = connect_user(&name).unwrap();
        client
            .write_all(&encode_frame(b"identity-only").unwrap())
            .unwrap();
        let request = pipe.receive(Duration::from_secs(2)).unwrap();
        assert_eq!(
            request.owner_ref(),
            format!("{}:{}", pipe.identity.sid, pipe.identity.session_id)
        );
        // SAFETY: live server pipe with a fully received client request.
        assert_ne!(
            unsafe { ImpersonateNamedPipeClient(pipe.file.as_raw_handle()) },
            0
        );
        let _revert = Revert;
        let mut raw_token = null_mut();
        // SAFETY: query-only thread token access, evaluated as the server.
        assert_ne!(
            unsafe { OpenThreadToken(GetCurrentThread(), TOKEN_QUERY, 1, &mut raw_token) },
            0
        );
        let token = Event(raw_token);
        let mut level: SECURITY_IMPERSONATION_LEVEL = 0;
        let mut written = 0;
        // SAFETY: output storage and size match the documented token information class.
        assert_ne!(
            unsafe {
                GetTokenInformation(
                    token.0,
                    TokenImpersonationLevel,
                    (&mut level as *mut SECURITY_IMPERSONATION_LEVEL).cast(),
                    size_of::<SECURITY_IMPERSONATION_LEVEL>() as u32,
                    &mut written,
                )
            },
            0
        );
        assert_eq!(written as usize, size_of::<SECURITY_IMPERSONATION_LEVEL>());
        assert_eq!(level, SecurityIdentification);
    }

    #[test]
    fn actual_server_token_must_match_expected_sid_and_session() {
        let name = format!(
            r"\\.\pipe\Sentinel-v1-user-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let _server = AuthenticatedPipe::bind(&name).unwrap();
        let client = connect_user(&name).unwrap();
        let identity = OsIdentity::current_process().unwrap();
        verify_server(&client, &identity).unwrap();
        let mut wrong = identity.clone();
        wrong.sid = "S-1-0-0".to_owned();
        assert_eq!(
            verify_server(&client, &wrong).unwrap_err().kind(),
            io::ErrorKind::PermissionDenied
        );
        wrong = identity;
        wrong.session_id += 1;
        assert_eq!(
            verify_server(&client, &wrong).unwrap_err().kind(),
            io::ErrorKind::PermissionDenied
        );
    }
}
