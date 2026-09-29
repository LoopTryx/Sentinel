use std::io;
use std::mem::{size_of, zeroed};
use std::ptr::null_mut;
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, LocalFree};
use windows_sys::Win32::Security::Authorization::ConvertSidToStringSidW;
use windows_sys::Win32::Security::{
    GetTokenInformation, RevertToSelf, TOKEN_ELEVATION, TOKEN_QUERY, TOKEN_USER, TokenElevation,
    TokenSessionId, TokenUser,
};
use windows_sys::Win32::System::Pipes::ImpersonateNamedPipeClient;
use windows_sys::Win32::System::Threading::{
    GetCurrentProcess, GetCurrentThread, OpenProcessToken, OpenThreadToken,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OsIdentity {
    pub sid: String,
    pub session_id: u32,
    pub elevated: bool,
}

struct OwnedHandle(HANDLE);

struct ImpersonationGuard(bool);

impl Drop for ImpersonationGuard {
    fn drop(&mut self) {
        if self.0 {
            // SAFETY: RevertToSelf restores the server thread token after pipe impersonation.
            if unsafe { RevertToSelf() } == 0 {
                std::process::abort();
            }
        }
    }
}

impl Drop for OwnedHandle {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: This handle was opened by OpenProcessToken and is owned here.
            unsafe { CloseHandle(self.0) };
        }
    }
}

impl OsIdentity {
    pub fn current_process() -> io::Result<Self> {
        let mut token: HANDLE = null_mut();
        // SAFETY: The output pointer is valid and GetCurrentProcess returns a process pseudo-handle.
        if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
            return Err(io::Error::last_os_error());
        }
        let token = OwnedHandle(token);
        Self::from_token(token.0)
    }

    pub(crate) fn from_pipe_client(pipe: HANDLE) -> io::Result<Self> {
        // Call only after reading a message from this local-only pipe. Windows then binds
        // impersonation to the client that sent the last message.
        // SAFETY: `pipe` is a connected named-pipe server handle owned by the caller.
        if unsafe { ImpersonateNamedPipeClient(pipe) } == 0 {
            return Err(io::Error::last_os_error());
        }
        let guard = ImpersonationGuard(true);
        let mut token: HANDLE = null_mut();
        // SAFETY: The current thread is impersonating the pipe client; output is valid.
        if unsafe { OpenThreadToken(GetCurrentThread(), TOKEN_QUERY, 1, &mut token) } == 0 {
            return Err(io::Error::last_os_error());
        }
        let token = OwnedHandle(token);
        let identity = Self::from_token(token.0)?;
        drop(token);
        drop(guard);
        Ok(identity)
    }

    pub(crate) fn from_token(token: HANDLE) -> io::Result<Self> {
        let mut required = 0u32;
        // SAFETY: A null buffer with length zero requests the required TokenUser size.
        unsafe { GetTokenInformation(token, TokenUser, null_mut(), 0, &mut required) };
        if required < size_of::<TOKEN_USER>() as u32 || required > 65_536 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "invalid token user length",
            ));
        }
        let mut words = vec![0usize; (required as usize).div_ceil(size_of::<usize>())];
        // SAFETY: The usize buffer is pointer-aligned and has at least `required` bytes.
        if unsafe {
            GetTokenInformation(
                token,
                TokenUser,
                words.as_mut_ptr().cast(),
                required,
                &mut required,
            )
        } == 0
        {
            return Err(io::Error::last_os_error());
        }
        // SAFETY: A successful TokenUser query populated an aligned TOKEN_USER at the start.
        let user = unsafe { &*(words.as_ptr().cast::<TOKEN_USER>()) };
        let sid = sid_to_string(user.User.Sid)?;

        let mut session_id = 0u32;
        // SAFETY: The output buffer is a valid u32 and its size is provided.
        if unsafe {
            GetTokenInformation(
                token,
                TokenSessionId,
                (&mut session_id as *mut u32).cast(),
                size_of::<u32>() as u32,
                &mut required,
            )
        } == 0
        {
            return Err(io::Error::last_os_error());
        }

        // SAFETY: TOKEN_ELEVATION is a plain Win32 output struct.
        let mut elevation: TOKEN_ELEVATION = unsafe { zeroed() };
        if unsafe {
            GetTokenInformation(
                token,
                TokenElevation,
                (&mut elevation as *mut TOKEN_ELEVATION).cast(),
                size_of::<TOKEN_ELEVATION>() as u32,
                &mut required,
            )
        } == 0
        {
            return Err(io::Error::last_os_error());
        }
        Ok(Self {
            sid,
            session_id,
            elevated: elevation.TokenIsElevated != 0,
        })
    }
}

fn sid_to_string(sid: windows_sys::Win32::Security::PSID) -> io::Result<String> {
    if sid.is_null() {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "missing SID"));
    }
    let mut raw = null_mut();
    // SAFETY: The SID came from a successful TokenUser query; the API allocates `raw`.
    if unsafe { ConvertSidToStringSidW(sid, &mut raw) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let mut length = 0usize;
    // SAFETY: ConvertSidToStringSidW returns a null-terminated allocated string.
    while length < 256 && unsafe { *raw.add(length) } != 0 {
        length += 1;
    }
    let result = if length == 256 {
        Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "SID string too long",
        ))
    } else {
        // SAFETY: `length` was measured within the allocated null-terminated string.
        Ok(String::from_utf16_lossy(unsafe {
            std::slice::from_raw_parts(raw, length)
        }))
    };
    // SAFETY: The string was allocated by ConvertSidToStringSidW and must be freed by LocalFree.
    unsafe { LocalFree(raw.cast()) };
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn process_identity_comes_from_windows_token() {
        let identity = OsIdentity::current_process().unwrap();
        assert!(identity.sid.starts_with("S-1-"));
    }
}
