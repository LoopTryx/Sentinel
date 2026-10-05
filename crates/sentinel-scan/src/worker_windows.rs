//! Windows resource boundary. Job assignment occurs inside CreateProcess,
//! before worker code runs. This does not restrict its token or network access.
use std::fs::File;
use std::io;
use std::mem::{size_of, zeroed};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{AsRawHandle, FromRawHandle};
use std::os::windows::process::ExitStatusExt;
use std::path::Path;
use std::process::ExitStatus;
use std::ptr::{null, null_mut};
use windows_sys::Win32::Foundation::*;
use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
use windows_sys::Win32::Storage::FileSystem::*;
use windows_sys::Win32::System::JobObjects::*;
use windows_sys::Win32::System::Pipes::CreatePipe;
use windows_sys::Win32::System::Threading::*;

struct Handle(HANDLE);
impl Handle {
    fn new(raw: HANDLE) -> io::Result<Self> {
        if raw.is_null() || raw == INVALID_HANDLE_VALUE {
            Err(io::Error::last_os_error())
        } else {
            Ok(Self(raw))
        }
    }
    fn into_file(self) -> File {
        let raw = self.0;
        std::mem::forget(self);
        // SAFETY: ownership of this unique valid handle is transferred to File.
        unsafe { File::from_raw_handle(raw) }
    }
}
impl Drop for Handle {
    fn drop(&mut self) {
        // SAFETY: this guard uniquely owns a valid handle.
        unsafe {
            CloseHandle(self.0);
        }
    }
}

struct Attributes {
    // usize storage gives the native attribute list pointer alignment.
    storage: Vec<usize>,
}
impl Attributes {
    fn new() -> io::Result<Self> {
        let mut bytes = 0;
        // SAFETY: the sizing call writes only the supplied size variable.
        unsafe {
            InitializeProcThreadAttributeList(null_mut(), 2, 0, &mut bytes);
        }
        if bytes == 0 {
            return Err(io::Error::last_os_error());
        }
        let mut storage = vec![0usize; bytes.div_ceil(size_of::<usize>())];
        // SAFETY: aligned storage has at least the requested byte size.
        check(unsafe {
            InitializeProcThreadAttributeList(storage.as_mut_ptr().cast(), 2, 0, &mut bytes)
        })?;
        Ok(Self { storage })
    }
    fn ptr(&mut self) -> LPPROC_THREAD_ATTRIBUTE_LIST {
        self.storage.as_mut_ptr().cast()
    }
    fn set(&mut self, kind: u32, handles: &[HANDLE]) -> io::Result<()> {
        // SAFETY: caller retains the handle array through CreateProcessW.
        check(unsafe {
            UpdateProcThreadAttribute(
                self.ptr(),
                0,
                kind as usize,
                handles.as_ptr().cast(),
                std::mem::size_of_val(handles),
                null_mut(),
                null(),
            )
        })
    }
}
impl Drop for Attributes {
    fn drop(&mut self) {
        // SAFETY: this is an initialized native attribute list.
        unsafe {
            DeleteProcThreadAttributeList(self.ptr());
        }
    }
}

pub(crate) struct WorkerChild {
    process: Handle,
    job: Option<Handle>,
    pub(crate) stdout: Option<File>,
}

impl WorkerChild {
    pub(crate) fn spawn(executable: &Path, source: &File) -> io::Result<Self> {
        let executable = executable.canonicalize()?;
        let application: Vec<u16> = executable
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect();
        if application[..application.len() - 1].contains(&0) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "invalid executable",
            ));
        }
        // A Windows filename cannot contain a quotation mark; no user arguments.
        let mut command: Vec<u16> = [
            vec![b'"' as u16],
            application[..application.len() - 1].to_vec(),
            "\" --scan-stdin\0".encode_utf16().collect(),
        ]
        .concat();
        // SAFETY: null security/name creates a private non-inheritable job.
        let job = Handle::new(unsafe { CreateJobObjectW(null(), null()) })?;
        // SAFETY: zero is a valid initial representation for the limit structure.
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { zeroed() };
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            | JOB_OBJECT_LIMIT_ACTIVE_PROCESS
            | JOB_OBJECT_LIMIT_PROCESS_MEMORY;
        limits.BasicLimitInformation.ActiveProcessLimit = 1;
        limits.ProcessMemoryLimit = 256 * 1024 * 1024;
        // SAFETY: pointer/length describe a live, correctly typed limit structure.
        check(unsafe {
            SetInformationJobObject(
                job.0,
                JobObjectExtendedLimitInformation,
                (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                size_of_val_u32(&limits),
            )
        })?;

        let mut raw_stdin = null_mut();
        // SAFETY: source is live; duplicate is independently owned, inheritable, same read-only access.
        check(unsafe {
            DuplicateHandle(
                GetCurrentProcess(),
                source.as_raw_handle(),
                GetCurrentProcess(),
                &mut raw_stdin,
                0,
                1,
                DUPLICATE_SAME_ACCESS,
            )
        })?;
        let stdin = Handle::new(raw_stdin)?;
        let security = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: null_mut(),
            bInheritHandle: 1,
        };
        let mut raw_read = null_mut();
        let mut raw_write = null_mut();
        // SAFETY: valid output pointers and security structure.
        check(unsafe { CreatePipe(&mut raw_read, &mut raw_write, &security, 0) })?;
        let stdout_read = Handle::new(raw_read)?;
        let stdout_write = Handle::new(raw_write)?;
        // SAFETY: parent-only read handle must not be inherited.
        check(unsafe { SetHandleInformation(stdout_read.0, HANDLE_FLAG_INHERIT, 0) })?;
        let nul: Vec<u16> = "NUL\0".encode_utf16().collect();
        // SAFETY: terminated device name and valid inheritable security attributes.
        let stderr = Handle::new(unsafe {
            CreateFileW(
                nul.as_ptr(),
                GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                &security,
                OPEN_EXISTING,
                FILE_ATTRIBUTE_NORMAL,
                null_mut(),
            )
        })?;
        let inherited = [stdin.0, stdout_write.0, stderr.0];
        let jobs = [job.0];
        let mut attributes = Attributes::new()?;
        attributes.set(PROC_THREAD_ATTRIBUTE_HANDLE_LIST, &inherited)?;
        attributes.set(PROC_THREAD_ATTRIBUTE_JOB_LIST, &jobs)?;
        // SAFETY: zero is valid initialization for these Windows output structures.
        let mut startup: STARTUPINFOEXW = unsafe { zeroed() };
        startup.StartupInfo.cb = size_of::<STARTUPINFOEXW>() as u32;
        startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
        startup.StartupInfo.hStdInput = stdin.0;
        startup.StartupInfo.hStdOutput = stdout_write.0;
        startup.StartupInfo.hStdError = stderr.0;
        startup.lpAttributeList = attributes.ptr();
        // SAFETY: zero is valid before CreateProcess fills process information.
        let mut info: PROCESS_INFORMATION = unsafe { zeroed() };
        // SAFETY: all buffers/attribute values remain live through this call.
        // JOB_LIST assignment is atomic; failure has no unrestricted fallback.
        check(unsafe {
            CreateProcessW(
                application.as_ptr(),
                command.as_mut_ptr(),
                null(),
                null(),
                1,
                CREATE_NO_WINDOW | EXTENDED_STARTUPINFO_PRESENT,
                null(),
                null(),
                &startup.StartupInfo,
                &mut info,
            )
        })?;
        let process = Handle::new(info.hProcess)?;
        let _thread = Handle::new(info.hThread)?;
        Ok(Self {
            process,
            job: Some(job),
            stdout: Some(stdout_read.into_file()),
        })
    }

    pub(crate) fn try_wait(&mut self) -> io::Result<Option<ExitStatus>> {
        // SAFETY: this object owns the process handle.
        match unsafe { WaitForSingleObject(self.process.0, 0) } {
            WAIT_TIMEOUT => Ok(None),
            WAIT_OBJECT_0 => {
                let mut code = 0;
                // SAFETY: valid process handle and output pointer.
                check(unsafe { GetExitCodeProcess(self.process.0, &mut code) })?;
                Ok(Some(ExitStatus::from_raw(code)))
            }
            _ => Err(io::Error::last_os_error()),
        }
    }
    pub(crate) fn kill(&mut self) -> io::Result<()> {
        if let Some(job) = &self.job {
            // SAFETY: the job belongs exclusively to this worker invocation.
            check(unsafe { TerminateJobObject(job.0, 1) })?;
        }
        Ok(())
    }
    pub(crate) fn wait(&mut self) -> io::Result<ExitStatus> {
        // Bounded cleanup even if explicit termination failed. Closing the last
        // job handle also requests termination independently.
        self.job.take();
        // SAFETY: owned process handle; timeout bounds failure cleanup.
        if unsafe { WaitForSingleObject(self.process.0, 1000) } != WAIT_OBJECT_0 {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "worker cleanup incomplete",
            ));
        }
        self.try_wait()?
            .ok_or_else(|| io::Error::other("worker still running"))
    }
}
impl Drop for WorkerChild {
    fn drop(&mut self) {
        self.job.take();
    }
}
fn check(success: i32) -> io::Result<()> {
    if success == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}
fn size_of_val_u32<T>(_: &T) -> u32 {
    size_of::<T>() as u32
}
