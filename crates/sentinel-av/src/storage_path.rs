//! Bounded Windows storage ancestry retention; not a private ACL policy.
use std::path::Path;

pub(crate) struct DirectoryGuard {
    _handles: Vec<std::fs::File>,
}

pub(crate) fn retain_directory(path: &Path, create: bool) -> Result<DirectoryGuard, String> {
    #[cfg(not(windows))]
    {
        let _ = (path, create);
        Err("quarantine storage ancestry unsupported".into())
    }
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
        use std::path::{Component, PathBuf, Prefix};
        use windows_sys::Win32::Storage::FileSystem::{
            FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_LIST_DIRECTORY,
            FILE_READ_ATTRIBUTES, FILE_SHARE_READ,
        };
        if path.as_os_str().encode_wide().count() > 1024 {
            return Err("quarantine storage path exceeds limit".into());
        }
        let text = path.to_str().ok_or("quarantine storage path unsupported")?;
        if text
            .split(['\\', '/'])
            .any(|part| part == "." || part == "..")
        {
            return Err("quarantine storage traversal unsupported".into());
        }
        let components: Vec<_> = path.components().collect();
        if components.len() > 32
            || !matches!(components.first(), Some(Component::Prefix(prefix)) if matches!(prefix.kind(), Prefix::Disk(_)))
            || !matches!(components.get(1), Some(Component::RootDir))
        {
            return Err("quarantine storage requires bounded absolute local disk path".into());
        }
        for part in components.iter().skip(2) {
            let Component::Normal(name) = part else {
                return Err("quarantine storage component unsupported".into());
            };
            let name = name.to_str().ok_or("quarantine storage name unsupported")?;
            let base = name.split('.').next().unwrap_or("").to_ascii_uppercase();
            if name.ends_with(['.', ' '])
                || name.contains(':')
                || matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL")
                || (base.len() == 4
                    && (base.starts_with("COM") || base.starts_with("LPT"))
                    && matches!(base.as_bytes()[3], b'1'..=b'9'))
            {
                return Err("quarantine storage alias unsupported".into());
            }
        }
        let mut current = PathBuf::new();
        current.push(components[0].as_os_str());
        current.push(components[1].as_os_str());
        let mut handles = Vec::with_capacity(components.len() - 1);
        for (index, component) in components.iter().enumerate().skip(1) {
            if index > 1 {
                current.push(component.as_os_str());
            }
            let open = || {
                std::fs::OpenOptions::new()
                    .read(true)
                    .access_mode(FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES)
                    .share_mode(FILE_SHARE_READ)
                    .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT)
                    .open(&current)
            };
            let handle = match open() {
                Ok(handle) => handle,
                Err(error)
                    if create && index > 1 && error.kind() == std::io::ErrorKind::NotFound =>
                {
                    match std::fs::create_dir(&current) {
                        Ok(()) => {}
                        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
                        Err(_) => return Err("quarantine storage directory creation failed".into()),
                    }
                    open().map_err(|_| "quarantine storage directory open failed")?
                }
                Err(_) => return Err("quarantine storage directory unavailable".into()),
            };
            let metadata = handle
                .metadata()
                .map_err(|_| "quarantine storage directory metadata failed")?;
            if !metadata.is_dir() || metadata.file_attributes() & 0x400 != 0 {
                return Err(
                    "quarantine storage reparse or nondirectory ancestor unsupported".into(),
                );
            }
            if index == 1 {
                use std::os::windows::io::AsRawHandle;
                use windows_sys::Win32::Storage::FileSystem::{
                    GetDriveTypeW, GetFinalPathNameByHandleW,
                };
                let root: Vec<u16> = current.as_os_str().encode_wide().chain(Some(0)).collect();
                let mut resolved = [0u16; 1025];
                // SAFETY: The root string is terminated and the live directory
                // handle and writable bounded buffer remain valid for each call.
                let drive_type = unsafe { GetDriveTypeW(root.as_ptr()) };
                let length = unsafe {
                    GetFinalPathNameByHandleW(
                        handle.as_raw_handle(),
                        resolved.as_mut_ptr(),
                        resolved.len() as u32,
                        0,
                    )
                } as usize;
                if drive_type != 3 || length == 0 || length >= resolved.len() {
                    return Err("quarantine storage volume unsupported".into());
                }
                let final_name = String::from_utf16(&resolved[..length])
                    .map_err(|_| "quarantine storage volume name unsupported")?;
                let expected = format!("\\\\?\\{}", current.display());
                if !final_name.eq_ignore_ascii_case(&expected) {
                    return Err("quarantine storage drive alias unsupported".into());
                }
            }
            // Retain every inspected ancestor before accessing its next child.
            // Excluding write/delete sharing rejects reparse mutation and rename
            // through ordinary cooperating Win32 handles, not privileged bypass.
            handles.push(handle);
        }
        Ok(DirectoryGuard { _handles: handles })
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn retained_ancestors_refuse_rename_until_guard_drops() {
        let root =
            std::env::temp_dir().join(format!("sentinel-retained-path-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let leaf = root.join("app/vault");
        let guard = retain_directory(&leaf, true).unwrap();
        assert!(std::fs::rename(root.join("app"), root.join("replacement")).is_err());
        assert!(std::fs::rename(&leaf, root.join("alternate")).is_err());
        use std::os::windows::fs::OpenOptionsExt;
        let write_open = || {
            std::fs::OpenOptions::new()
                .write(true)
                .custom_flags(0x02000000)
                .open(&leaf)
        };
        assert!(write_open().is_err());
        drop(guard);
        drop(write_open().unwrap());
        std::fs::rename(root.join("app"), root.join("replacement")).unwrap();
        std::fs::remove_dir_all(root).unwrap();
    }
}
