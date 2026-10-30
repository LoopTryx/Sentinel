//! Read-only private-directory policy; does not modify a security descriptor.
use std::path::Path;
pub(crate) fn validate(path: &Path) -> Result<(), String> {
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("quarantine private storage inspection unsupported".into())
    }
    #[cfg(windows)]
    {
        windows::validate(path)
    }
}
pub(crate) fn validate_file(file: &std::fs::File) -> Result<(), String> {
    #[cfg(not(windows))]
    {
        let _ = file;
        Err("quarantine private file policy unsupported".into())
    }
    #[cfg(windows)]
    {
        windows::validate_file(file)
    }
}
pub(crate) fn create_file(path: &Path) -> std::io::Result<std::fs::File> {
    #[cfg(windows)]
    {
        windows::create_file(path)
    }
    #[cfg(not(windows))]
    {
        std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .open(path)
    }
}
#[cfg(windows)]
pub(crate) fn create_directory(path: &Path) -> std::io::Result<()> {
    windows::create_directory(path)
}

#[cfg(all(test, windows))]
mod creation_tests {
    #[test]
    fn private_file_creation_sets_valid_owner_and_refuses_existing_files() {
        use std::io::Write;
        let root =
            std::env::temp_dir().join(format!("sentinel-private-create-{}", uuid::Uuid::new_v4()));
        super::create_directory(&root).unwrap();
        let path = root.join("owned.bin");
        let mut file = super::create_file(&path).unwrap();
        super::validate_file(&file).unwrap();
        file.write_all(b"harmless retained bytes").unwrap();
        file.sync_all().unwrap();
        assert!(super::create_file(&path).is_err());
        drop(file);
        assert_eq!(std::fs::read(&path).unwrap(), b"harmless retained bytes");
        std::fs::remove_file(&path).unwrap();
        std::fs::remove_dir(&root).unwrap();
    }
}
#[cfg(windows)]
mod windows {
    use std::{
        mem::size_of,
        os::windows::{fs::OpenOptionsExt, io::AsRawHandle},
        ptr::null_mut,
    };
    use windows_sys::Win32::{
        Foundation::{CloseHandle, HANDLE},
        Security::*,
        Storage::FileSystem::{
            FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_READ_ATTRIBUTES,
            FILE_SHARE_READ,
        },
        System::Threading::{GetCurrentProcess, OpenProcessToken},
    };
    struct Handle(HANDLE);
    impl Drop for Handle {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
    const REFUSE: &str = "quarantine private storage policy unavailable or unsupported";
    fn current_user() -> Result<Vec<usize>, String> {
        let mut handle = null_mut();
        // SAFETY: Valid output, current process pseudo-handle; token is query-only.
        if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut handle) } == 0 {
            return Err(REFUSE.into());
        }
        let token = Handle(handle);
        let mut required = 0;
        unsafe {
            GetTokenInformation(token.0, TokenUser, null_mut(), 0, &mut required);
        }
        if !(size_of::<TOKEN_USER>() as u32..=65536).contains(&required) {
            return Err(REFUSE.into());
        }
        let capacity = required;
        let mut words = vec![0usize; (capacity as usize).div_ceil(size_of::<usize>())];
        // SAFETY: Aligned owned buffer sized by bounded TokenUser query.
        if unsafe {
            GetTokenInformation(
                token.0,
                TokenUser,
                words.as_mut_ptr().cast(),
                capacity,
                &mut required,
            )
        } == 0
            || required > capacity
        {
            return Err(REFUSE.into());
        }
        Ok(words)
    }
    pub(super) fn validate(path: &std::path::Path) -> Result<(), String> {
        // Caller retains validated volume ancestry throughout this query.
        let directory = std::fs::OpenOptions::new()
            .read(true)
            .access_mode(0x00020000 | FILE_READ_ATTRIBUTES)
            .share_mode(FILE_SHARE_READ)
            .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT)
            .open(path)
            .map_err(|_| REFUSE)?;
        use std::os::windows::fs::MetadataExt;
        let metadata = directory.metadata().map_err(|_| REFUSE)?;
        if !metadata.is_dir() || metadata.file_attributes() & 0x400 != 0 {
            return Err(REFUSE.into());
        }
        validate_handle(&directory, true)
    }
    pub(super) fn validate_file(file: &std::fs::File) -> Result<(), String> {
        use std::os::windows::fs::MetadataExt;
        let metadata = file.metadata().map_err(|_| REFUSE)?;
        if !metadata.is_file() || metadata.file_attributes() & 0x400 != 0 {
            return Err(REFUSE.into());
        }
        validate_handle(file, false)
    }
    fn validate_handle(directory: &std::fs::File, is_directory: bool) -> Result<(), String> {
        let user_buffer = current_user()?;
        // SAFETY: Successful aligned TokenUser query; allocation stays live.
        let user = unsafe { (*user_buffer.as_ptr().cast::<TOKEN_USER>()).User.Sid };
        let mut system = [0usize; 9];
        let mut system_size = size_of_val(&system) as u32;
        if unsafe {
            CreateWellKnownSid(
                WinLocalSystemSid,
                null_mut(),
                system.as_mut_ptr().cast(),
                &mut system_size,
            )
        } == 0
        {
            return Err(REFUSE.into());
        }
        let mut owner = null_mut();
        let mut acl = null_mut();
        // Query a bounded aligned self-relative descriptor from the retained
        // handle, including its protection control bits.
        let information = OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION;
        let mut required = 0;
        unsafe {
            GetKernelObjectSecurity(
                directory.as_raw_handle(),
                information,
                null_mut(),
                0,
                &mut required,
            );
        }
        if !(20..=65536).contains(&required) {
            return Err(REFUSE.into());
        }
        let capacity = required;
        let mut descriptor_words = vec![0usize; (capacity as usize).div_ceil(size_of::<usize>())];
        let descriptor = descriptor_words.as_mut_ptr().cast();
        if unsafe {
            GetKernelObjectSecurity(
                directory.as_raw_handle(),
                information,
                descriptor,
                capacity,
                &mut required,
            )
        } == 0
            || required > capacity
            || unsafe { IsValidSecurityDescriptor(descriptor) } == 0
        {
            return Err(REFUSE.into());
        }
        let mut defaulted = 0;
        let mut present = 0;
        if unsafe { GetSecurityDescriptorOwner(descriptor, &mut owner, &mut defaulted) } == 0
            || unsafe {
                GetSecurityDescriptorDacl(descriptor, &mut present, &mut acl, &mut defaulted)
            } == 0
            || present == 0
            || owner.is_null()
            || acl.is_null()
        {
            return Err(REFUSE.into());
        }
        let mut control = 0;
        let mut revision = 0;
        // SAFETY: OS-returned descriptor/SIDs/ACL remain allocated through checks.
        if unsafe { GetSecurityDescriptorControl(descriptor, &mut control, &mut revision) } == 0
            || (is_directory && control & SE_DACL_PROTECTED == 0)
            || unsafe { IsValidAcl(acl) } == 0
            || unsafe { EqualSid(owner, user) } == 0
        {
            return Err(REFUSE.into());
        }
        let (count, length) = unsafe { ((*acl).AceCount, (*acl).AclSize as usize) };
        if count == 0 || count > 2 || !(size_of::<ACL>()..=256).contains(&length) {
            return Err(REFUSE.into());
        }
        let mut owner_grant = false;
        let mut system_grant = false;
        for index in 0..count {
            let mut ace = null_mut();
            if unsafe { GetAce(acl, index as u32, &mut ace) } == 0 || ace.is_null() {
                return Err(REFUSE.into());
            }
            let start = acl as usize;
            let address = ace as usize;
            if address < start + size_of::<ACL>()
                || address > start + length - size_of::<ACE_HEADER>()
            {
                return Err(REFUSE.into());
            }
            let header = unsafe { &*ace.cast::<ACE_HEADER>() };
            let size = header.AceSize as usize;
            if header.AceType != 0
                || if is_directory {
                    header.AceFlags != (OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE) as u8
                } else {
                    header.AceFlags != 0 && header.AceFlags != INHERITED_ACE as u8
                }
                || !(16..=76).contains(&size)
                || size > start + length - address
            {
                return Err(REFUSE.into());
            }
            // Validate SID's declared bytes within this ACE before native SID queries.
            let bytes = unsafe { std::slice::from_raw_parts(ace.cast::<u8>(), size) };
            let sid_length = 8 + 4 * bytes[9] as usize;
            if bytes[8] != 1 || bytes[9] > 15 || 8 + sid_length != size {
                return Err(REFUSE.into());
            }
            let allowed = unsafe { &*ace.cast::<ACCESS_ALLOWED_ACE>() };
            if allowed.Mask != 0x001f01ff {
                return Err(REFUSE.into());
            }
            let sid = unsafe { ace.cast::<u8>().add(8).cast() };
            if unsafe { IsValidSid(sid) } == 0 {
                return Err(REFUSE.into());
            }
            if unsafe { EqualSid(sid, user) } != 0 {
                if owner_grant {
                    return Err(REFUSE.into());
                }
                owner_grant = true;
            } else if unsafe { EqualSid(sid, system.as_mut_ptr().cast()) } != 0 {
                if system_grant {
                    return Err(REFUSE.into());
                }
                system_grant = true;
            } else {
                return Err(REFUSE.into());
            }
        }
        if !owner_grant {
            return Err(REFUSE.into());
        }
        Ok(())
    }
    pub(super) fn create_directory(path: &std::path::Path) -> std::io::Result<()> {
        with_private_security(path, true, |wide, attributes| {
            // SAFETY: Both buffers remain live through this synchronous call.
            if unsafe {
                windows_sys::Win32::Storage::FileSystem::CreateDirectoryW(wide, attributes)
            } == 0
            {
                return Err(std::io::Error::last_os_error());
            }
            Ok(())
        })
    }
    pub(super) fn create_file(path: &std::path::Path) -> std::io::Result<std::fs::File> {
        use std::os::windows::io::FromRawHandle;
        use windows_sys::Win32::{
            Foundation::INVALID_HANDLE_VALUE,
            Storage::FileSystem::{
                CreateFileW, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, FILE_FLAG_OPEN_REPARSE_POINT,
            },
        };
        with_private_security(path, false, |wide, attributes| {
            // SAFETY: Caller retains private parent ancestry. CREATE_NEW refuses
            // replacements; exclusive sharing and explicit owner/DACL are atomic.
            let handle = unsafe {
                CreateFileW(
                    wide,
                    0xc0000000,
                    0,
                    attributes,
                    CREATE_NEW,
                    FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT,
                    std::ptr::null_mut(),
                )
            };
            if handle == INVALID_HANDLE_VALUE {
                return Err(std::io::Error::last_os_error());
            }
            // SAFETY: A fresh valid owned handle transfers exactly once to File.
            Ok(unsafe { std::fs::File::from_raw_handle(handle) })
        })
    }
    fn with_private_security<T>(
        path: &std::path::Path,
        directory: bool,
        create: impl FnOnce(*const u16, *const SECURITY_ATTRIBUTES) -> std::io::Result<T>,
    ) -> std::io::Result<T> {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::{
            Foundation::LocalFree,
            Security::Authorization::{
                ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
                SDDL_REVISION_1,
            },
        };
        struct Allocation(*mut std::ffi::c_void);
        impl Drop for Allocation {
            fn drop(&mut self) {
                unsafe {
                    LocalFree(self.0);
                }
            }
        }
        let user_buffer = current_user().map_err(std::io::Error::other)?;
        // SAFETY: Successful aligned TokenUser query; allocation remains live.
        let user = unsafe { (*user_buffer.as_ptr().cast::<TOKEN_USER>()).User.Sid };
        let mut sid_text = null_mut();
        if unsafe { ConvertSidToStringSidW(user, &mut sid_text) } == 0 {
            return Err(std::io::Error::last_os_error());
        }
        let _sid_text = Allocation(sid_text.cast());
        let mut length = 0;
        while length < 256 && unsafe { *sid_text.add(length) } != 0 {
            length += 1;
        }
        if length == 256 {
            return Err(std::io::Error::other(REFUSE));
        }
        // SAFETY: OS allocated terminated SID text, bounded above and live.
        let sid = String::from_utf16(unsafe { std::slice::from_raw_parts(sid_text, length) })
            .map_err(|_| std::io::Error::other(REFUSE))?;
        let flags = if directory { "OICI" } else { "" };
        let sddl: Vec<u16> = format!("O:{sid}D:P(A;{flags};FA;;;{sid})(A;{flags};FA;;;SY)")
            .encode_utf16()
            .chain(Some(0))
            .collect();
        let mut descriptor = null_mut();
        if unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(),
                SDDL_REVISION_1,
                &mut descriptor,
                null_mut(),
            )
        } == 0
        {
            return Err(std::io::Error::last_os_error());
        }
        let _descriptor = Allocation(descriptor);
        let attributes = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor,
            bInheritHandle: 0,
        };
        let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        create(wide.as_ptr(), &attributes)
    }
}
