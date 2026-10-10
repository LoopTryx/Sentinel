//! Private inspected object/content association. This is not caller consent,
//! an IPC capability or permission to quarantine. Never serialize file IDs.
use sha2::{Digest, Sha256};
use std::fs::File;

#[derive(Clone, PartialEq, Eq)]
struct FileIdentity {
    volume: u64,
    id: [u8; 16],
}

/// Created only from the engine's live, fully inspected file handle. Native
/// must separately authorize the caller/action and bind it to the current job.
/// Missing platform identity means the checked action is unavailable.
#[derive(Clone)]
pub struct InspectedSubject {
    identity: FileIdentity,
    digest: [u8; 32],
    bytes: u64,
}

impl std::fmt::Debug for InspectedSubject {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("InspectedSubject { private }")
    }
}

impl InspectedSubject {
    pub(crate) fn capture(file: &File, digest: &str, bytes: u64) -> Option<Self> {
        if digest.len() != 64 {
            return None;
        }
        Some(Self {
            identity: identity(file).ok()?,
            digest: hex::decode(digest).ok()?.try_into().ok()?,
            bytes,
        })
    }

    pub(crate) fn matches(&self, file: &File, plaintext: &[u8]) -> Result<(), String> {
        if identity(file)? != self.identity
            || plaintext.len() as u64 != self.bytes
            || Sha256::digest(plaintext).as_slice() != self.digest
        {
            return Err("inspected subject changed or unavailable".into());
        }
        Ok(())
    }
}

fn identity(file: &File) -> Result<FileIdentity, String> {
    #[cfg(not(windows))]
    {
        let _ = file;
        Err("inspected object identity unsupported".into())
    }
    #[cfg(windows)]
    {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::Storage::FileSystem::{
            FileIdInfo, GetFileInformationByHandleEx, FILE_ID_INFO,
        };
        let mut information = std::mem::MaybeUninit::<FILE_ID_INFO>::uninit();
        // SAFETY: File owns a live handle. The synchronous call writes exactly
        // this correctly sized structure; it is read only on success.
        let result = unsafe {
            GetFileInformationByHandleEx(
                file.as_raw_handle(),
                FileIdInfo,
                information.as_mut_ptr().cast(),
                std::mem::size_of::<FILE_ID_INFO>() as u32,
            )
        };
        if result == 0 {
            return Err("inspected object identity unavailable".into());
        }
        // SAFETY: a successful call initialized the complete structure.
        let information = unsafe { information.assume_init() };
        if information.VolumeSerialNumber == 0 || information.FileId.Identifier == [0; 16] {
            return Err("inspected object identity unavailable".into());
        }
        Ok(FileIdentity {
            volume: information.VolumeSerialNumber,
            id: information.FileId.Identifier,
        })
    }
}
