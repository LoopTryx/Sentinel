//! Bounded Windows storage ancestry retention; not a private ACL policy.
use std::path::Path;

pub(crate) struct DirectoryGuard {
    _handles: Vec<std::fs::File>,
    pub(crate) path: std::path::PathBuf,
}

pub(crate) struct FileParentGuard {
    pub(crate) path: std::path::PathBuf,
    _parent: DirectoryGuard,
}

#[cfg(windows)]
fn validate_name(name: &std::ffi::OsStr) -> Result<(), String> {
    let name = name.to_str().ok_or("quarantine path name unsupported")?;
    let base = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    if name.is_empty()
        || name.ends_with(['.', ' '])
        || name.contains([':', '\0'])
        || matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (base.len() == 4
            && (base.starts_with("COM") || base.starts_with("LPT"))
            && matches!(base.as_bytes()[3], b'1'..=b'9'))
    {
        return Err("quarantine path alias unsupported".into());
    }
    Ok(())
}

/// Selected source/target paths use an ordinary absolute local disk path.
/// The resolved parent is retained through the caller's entire file operation.
pub(crate) fn retain_file_parent(path: &Path, create: bool) -> Result<FileParentGuard, String> {
    #[cfg(not(windows))]
    {
        let _ = (path, create);
        Err("quarantine selected file ancestry unsupported".into())
    }
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let text = path
            .to_str()
            .ok_or("quarantine selected path unsupported")?;
        if text.ends_with(['\\', '/'])
            || text
                .split(['\\', '/'])
                .any(|part| part == "." || part == "..")
            || path.as_os_str().encode_wide().count() > 1024
        {
            return Err("quarantine selected path unsupported or exceeds limit".into());
        }
        let name = path
            .file_name()
            .ok_or("quarantine selected filename unavailable")?;
        validate_name(name)?;
        let parent = retain_directory_inner(
            path.parent()
                .ok_or("quarantine selected parent unavailable")?,
            create,
            false,
            Some(name),
            false,
        )?;
        let resolved = parent.path.join(name);
        if resolved.as_os_str().encode_wide().count() > 1024 {
            return Err("quarantine selected volume path exceeds limit".into());
        }
        Ok(FileParentGuard {
            path: resolved,
            _parent: parent,
        })
    }
}

#[cfg(all(test, windows))]
pub(crate) fn retain_directory(path: &Path, create: bool) -> Result<DirectoryGuard, String> {
    retain_directory_inner(path, create, false, None, false)
}

pub(crate) fn retain_pinned_directory(path: &Path) -> Result<DirectoryGuard, String> {
    retain_directory_inner(path, false, true, None, false)
}

pub(crate) fn retain_private_directory(
    path: &Path,
    reserved_child: Option<&std::ffi::OsStr>,
) -> Result<DirectoryGuard, String> {
    retain_directory_inner(path, true, false, reserved_child, true)
}
pub(crate) fn retain_private_child_directory(path: &Path) -> Result<DirectoryGuard, String> {
    retain_directory_inner(path, true, true, None, true)
}

fn retain_directory_inner(
    path: &Path,
    create: bool,
    pinned: bool,
    selected_name: Option<&std::ffi::OsStr>,
    private_creation: bool,
) -> Result<DirectoryGuard, String> {
    #[cfg(not(windows))]
    {
        let _ = (path, create, pinned, selected_name, private_creation);
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
        let supported_prefix = match components.first() {
            Some(Component::Prefix(prefix)) => match prefix.kind() {
                Prefix::Disk(_) => !pinned,
                Prefix::Verbatim(name) if pinned => name.to_str().is_some_and(|name| {
                    name.strip_prefix("Volume{")
                        .and_then(|name| name.strip_suffix('}'))
                        .is_some_and(|id| {
                            uuid::Uuid::parse_str(id).is_ok_and(|uuid| {
                                uuid.hyphenated().to_string().eq_ignore_ascii_case(id)
                            })
                        })
                }),
                _ => false,
            },
            _ => false,
        };
        if components.len() > 32
            || !supported_prefix
            || !matches!(components.get(1), Some(Component::RootDir))
        {
            return Err("quarantine storage requires bounded absolute local disk path".into());
        }
        for part in components.iter().skip(2) {
            let Component::Normal(name) = part else {
                return Err("quarantine storage component unsupported".into());
            };
            validate_name(name)?;
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
                    match if private_creation {
                        crate::storage_privacy::create_directory(&current)
                    } else {
                        std::fs::create_dir(&current)
                    } {
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
                        if pinned { 1 } else { 0 },
                    )
                } as usize;
                if drive_type != 3 || length == 0 || length >= resolved.len() {
                    return Err("quarantine storage volume unsupported".into());
                }
                let final_name = String::from_utf16(&resolved[..length])
                    .map_err(|_| "quarantine storage volume name unsupported")?;
                let expected = if pinned {
                    current.to_string_lossy().into_owned()
                } else {
                    format!("\\\\?\\{}", current.display())
                };
                if !final_name.eq_ignore_ascii_case(&expected) {
                    return Err("quarantine storage drive alias unsupported".into());
                }
                if !pinned {
                    // Resolve from the already retained root handle, then use
                    // this volume address for every subsequent child operation.
                    let length = unsafe {
                        GetFinalPathNameByHandleW(
                            handle.as_raw_handle(),
                            resolved.as_mut_ptr(),
                            resolved.len() as u32,
                            1,
                        )
                    } as usize;
                    if length == 0 || length >= resolved.len() {
                        return Err("quarantine storage volume address unavailable".into());
                    }
                    let volume = String::from_utf16(&resolved[..length])
                        .map_err(|_| "quarantine volume address unsupported")?;
                    let root = PathBuf::from(volume);
                    if !matches!(root.components().next(), Some(Component::Prefix(prefix)) if matches!(prefix.kind(), Prefix::Verbatim(_)))
                    {
                        return Err("quarantine volume address unsupported".into());
                    }
                    let mut final_path = root.clone();
                    for component in components.iter().skip(2) {
                        final_path.push(component.as_os_str());
                    }
                    // Include the selected filename before any missing parent
                    // can be created; GUID resolution can lengthen a DOS path.
                    if let Some(name) = selected_name {
                        final_path.push(name);
                    }
                    if final_path.as_os_str().encode_wide().count() > 1024 {
                        return Err("quarantine pinned storage path exceeds limit".into());
                    }
                    current = root;
                }
            }
            // Retain every inspected ancestor before accessing its next child.
            // Excluding write/delete sharing rejects reparse mutation and rename
            // through ordinary cooperating Win32 handles, not privileged bypass.
            handles.push(handle);
        }
        Ok(DirectoryGuard {
            _handles: handles,
            path: current,
        })
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
