//! Recovery-only native broker engine. No apply/enroll operation is exported.
//! The fixed native host validates private retained file/directory handles before
//! transferring ownership of a non-inheritable file-handle duplicate here.
use sentinel_usb::journal::JournalStore;
use sentinel_usb::policy::{InputPolicy, PolicyBackend, Registry};
use sentinel_usb::recovery::{Error, Recovery};
use std::fs::File;

/// Internal native integration seam; not IPC. Registry recovery derives the owned
/// delta exclusively from the durable journal, never from a renderer allowlist.
pub fn recover_file<R: Registry>(file: File, registry: R) -> Result<bool, Error> {
    let store = JournalStore::from_trusted_file(file)?;
    // Recovery ignores the constructor profile and decodes the journal's delta.
    // This value cannot be applied: this engine exports no apply method.
    let profile = InputPolicy::new(&["HID\\RECOVERY\\UNUSED"])?;
    Recovery::new(store, PolicyBackend::new(registry, profile)).recover_pending()
}

/// Consume exactly one owned native file-handle duplicate. The caller must not
/// close or use it afterward, including on error. Codes: 0 recovered/empty,
/// 1 recovery failed (journal retained), 2 unsupported/invalid argument.
///
/// # Safety
/// On Windows `handle` must be a live, uniquely owned file handle created and
/// validated by the protected native host. Arbitrary numeric IPC handles are forbidden.
#[unsafe(no_mangle)]
pub unsafe extern "system" fn sentinel_usb_recover(handle: isize) -> u32 {
    if handle <= 0 {
        return 2;
    }
    #[cfg(windows)]
    {
        use std::os::windows::io::FromRawHandle;
        let result = std::panic::catch_unwind(|| {
            // SAFETY: ownership of the validated duplicate is transferred by host.
            let file = unsafe { File::from_raw_handle(handle as *mut std::ffi::c_void) };
            recover_file(
                file,
                sentinel_usb::policy::windows::WindowsRegistry::machine(),
            )
        });
        match result {
            Ok(Ok(_)) => 0,
            _ => 1,
        }
    }
    #[cfg(not(windows))]
    {
        2
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn invalid_handles_never_reach_the_registry() {
        // SAFETY: invalid sentinels are rejected before handle ownership is taken.
        assert_eq!(unsafe { super::sentinel_usb_recover(0) }, 2);
        assert_eq!(unsafe { super::sentinel_usb_recover(-1) }, 2);
    }
}
