//! Native registry provider. No device policy is changed by construction or read.
//! Only trusted serialized broker code may call mutation through Recovery after
//! durable intent and independent watchdog readiness. Not a public app command.
use super::{Entry, Error, Registry};
use std::ptr::{null, null_mut};
use windows_sys::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_NO_MORE_ITEMS, ERROR_SUCCESS};
use windows_sys::Win32::System::Registry::*;

struct Key(HKEY);
impl Drop for Key {
    fn drop(&mut self) {
        // SAFETY: each Key owns exactly one successful open/create result.
        unsafe {
            RegCloseKey(self.0);
        }
    }
}
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain([0]).collect()
}
fn status(code: u32) -> Result<(), Error> {
    if code == ERROR_SUCCESS {
        Ok(())
    } else {
        Err(Error::Platform)
    }
}
fn reject_link(key: &Key) -> Result<(), Error> {
    let name = wide("SymbolicLinkValue");
    let mut kind = 0;
    let mut size = 0;
    // SAFETY: valid owned handle, terminated name, output pointers; no data read.
    let code = unsafe {
        RegQueryValueExW(
            key.0,
            name.as_ptr(),
            null(),
            &mut kind,
            null_mut(),
            &mut size,
        )
    };
    if code == ERROR_FILE_NOT_FOUND {
        return Ok(());
    }
    status(code)?;
    // Any such value is unexpected, including malformed link encodings.
    Err(Error::Conflict)
}
fn open_child(parent: HKEY, name: &str, create: bool) -> Result<Option<Key>, Error> {
    let name = wide(name);
    let access = KEY_READ | KEY_WOW64_64KEY | if create { KEY_WRITE } else { 0 };
    let mut raw = null_mut();
    // SAFETY: caller supplies a live parent, terminated name and valid output.
    let mut code = unsafe {
        RegOpenKeyExW(
            parent,
            name.as_ptr(),
            REG_OPTION_OPEN_LINK,
            access,
            &mut raw,
        )
    };
    if code == ERROR_FILE_NOT_FOUND && create {
        // SAFETY: creating a single relative component; no custom descriptor or
        // class pointer. HKLM inherits system policy ACLs. No recursive deletion.
        code = unsafe {
            RegCreateKeyExW(
                parent,
                name.as_ptr(),
                0,
                null(),
                REG_OPTION_NON_VOLATILE,
                access,
                null(),
                &mut raw,
                null_mut(),
            )
        };
    }
    if code == ERROR_FILE_NOT_FOUND {
        return Ok(None);
    }
    status(code)?;
    let key = Key(raw);
    reject_link(&key)?;
    Ok(Some(key))
}

pub struct WindowsRegistry {
    hive: HKEY,
    path: String,
}
impl WindowsRegistry {
    /// Fixed machine-policy target. Construction performs no read or mutation.
    /// Administrator rights and the reviewed broker/recovery gates are required
    /// for mutation. Do not call with a UI's assertion that those gates passed.
    pub fn machine() -> Self {
        Self {
            hive: HKEY_LOCAL_MACHINE,
            path: "Software\\Policies\\Microsoft\\Windows\\DeviceInstall\\Restrictions".into(),
        }
    }
    fn root(&self, create: bool) -> Result<Option<Key>, Error> {
        let mut held: Option<Key> = None;
        for component in self.path.split('\\') {
            let parent = held.as_ref().map_or(self.hive, |key| key.0);
            let next = open_child(parent, component, create)?;
            if next.is_none() {
                return Ok(None);
            }
            held = next;
        }
        Ok(held)
    }
    fn target(&self, name: &str, create: bool) -> Result<Option<Key>, Error> {
        if !["", "AllowInstanceIDs", "DenyDeviceClasses", "DenyDeviceIDs"].contains(&name) {
            return Err(Error::Invalid);
        }
        let Some(root) = self.root(create)? else {
            return Ok(None);
        };
        if name.is_empty() {
            Ok(Some(root))
        } else {
            open_child(root.0, name, create)
        }
    }
}

fn subkeys(key: &Key) -> Result<Vec<String>, Error> {
    let mut names = Vec::new();
    // At most three allowed subkeys, plus one sentinel read to refuse extras.
    for index in 0..4 {
        let mut buffer = [0u16; 65];
        let mut length = buffer.len() as u32;
        // SAFETY: fixed writable buffer/length; unused optional outputs are null.
        let code = unsafe {
            RegEnumKeyExW(
                key.0,
                index,
                buffer.as_mut_ptr(),
                &mut length,
                null(),
                null_mut(),
                null_mut(),
                null_mut(),
            )
        };
        if code == ERROR_NO_MORE_ITEMS {
            return Ok(names);
        }
        status(code)?;
        if length as usize >= buffer.len() {
            return Err(Error::Invalid);
        }
        names.push(String::from_utf16(&buffer[..length as usize]).map_err(|_| Error::Invalid)?);
    }
    Err(Error::Conflict)
}
fn values(key: &Key, path: &str, output: &mut Vec<Entry>) -> Result<(), Error> {
    for index in 0..=super::MAX_ENTRIES as u32 {
        let mut name = [0u16; 65];
        let mut name_length = name.len() as u32;
        let mut data = [0u8; 512];
        let mut length = data.len() as u32;
        let mut kind = 0;
        // SAFETY: buffers have lengths passed to the API; all pointers remain live.
        let code = unsafe {
            RegEnumValueW(
                key.0,
                index,
                name.as_mut_ptr(),
                &mut name_length,
                null(),
                &mut kind,
                data.as_mut_ptr(),
                &mut length,
            )
        };
        if code == ERROR_NO_MORE_ITEMS {
            return Ok(());
        }
        status(code)?;
        if output.len() >= super::MAX_ENTRIES
            || name_length as usize >= name.len()
            || length as usize > data.len()
            || kind == REG_LINK
        {
            return Err(Error::Invalid);
        }
        output.push(Entry {
            key: path.into(),
            name: String::from_utf16(&name[..name_length as usize]).map_err(|_| Error::Invalid)?,
            kind,
            data: data[..length as usize].to_vec(),
        });
    }
    Err(Error::Invalid)
}
fn valid_entry(entry: &Entry) -> bool {
    if entry.key.is_empty() {
        [
            "AllowDenyLayered",
            "AllowInstanceIDs",
            "DenyDeviceClassesRetroactive",
            "DenyDeviceClasses",
            "DenyDeviceIDsRetroactive",
            "DenyDeviceIDs",
        ]
        .contains(&entry.name.as_str())
            && entry.kind == REG_DWORD
            && entry.data == 1u32.to_le_bytes()
    } else {
        ["AllowInstanceIDs", "DenyDeviceClasses", "DenyDeviceIDs"].contains(&entry.key.as_str())
            && entry.name.parse::<u8>().is_ok_and(|n| {
                (1..=if entry.key == "AllowInstanceIDs" {
                    super::MAX_APPROVALS as u8
                } else if entry.key == "DenyDeviceClasses" {
                    3
                } else {
                    1
                })
                    .contains(&n)
                    && n.to_string() == entry.name
            })
            && entry.kind == REG_SZ
            && (4..=402).contains(&entry.data.len())
            && entry.data.len().is_multiple_of(2)
            && entry.data.ends_with(&[0, 0])
    }
}
impl Registry for WindowsRegistry {
    fn snapshot(&mut self) -> Result<Vec<Entry>, Error> {
        let Some(root) = self.root(false)? else {
            return Ok(Vec::new());
        };
        let mut output = Vec::new();
        values(&root, "", &mut output)?;
        for name in subkeys(&root)? {
            let canonical = ["AllowInstanceIDs", "DenyDeviceClasses", "DenyDeviceIDs"]
                .into_iter()
                .find(|known| known.eq_ignore_ascii_case(&name))
                .ok_or(Error::Conflict)?;
            let child = open_child(root.0, canonical, false)?.ok_or(Error::Conflict)?;
            if !subkeys(&child)?.is_empty() {
                return Err(Error::Conflict);
            }
            values(&child, canonical, &mut output)?;
        }
        Ok(output)
    }
    fn set(&mut self, entry: &Entry) -> Result<(), Error> {
        if !valid_entry(entry) {
            return Err(Error::Invalid);
        }
        let key = self.target(&entry.key, true)?.ok_or(Error::Platform)?;
        let name = wide(&entry.name);
        let mut length = 0;
        // SAFETY: probe the same held key immediately before setting; no data
        // allocation depends on a registry-supplied size.
        let existing = unsafe {
            RegQueryValueExW(
                key.0,
                name.as_ptr(),
                null(),
                null_mut(),
                null_mut(),
                &mut length,
            )
        };
        if existing != ERROR_FILE_NOT_FOUND {
            status(existing)?;
            return Err(Error::Conflict);
        }
        // SAFETY: bounded byte buffer, exact byte count, terminated name, owned key.
        status(unsafe {
            RegSetValueExW(
                key.0,
                name.as_ptr(),
                0,
                entry.kind,
                entry.data.as_ptr(),
                entry.data.len() as u32,
            )
        })
    }
    fn remove(&mut self, entry: &Entry) -> Result<(), Error> {
        if !valid_entry(entry) {
            return Err(Error::Invalid);
        }
        // Open with write access without creating missing keys during recovery.
        let Some(read) = self.target(&entry.key, false)? else {
            return Ok(());
        };
        let mut raw = null_mut();
        // SAFETY: duplicate access to the held key via an empty relative name.
        status(unsafe {
            RegOpenKeyExW(
                read.0,
                wide("").as_ptr(),
                REG_OPTION_OPEN_LINK,
                KEY_READ | KEY_WRITE | KEY_WOW64_64KEY,
                &mut raw,
            )
        })?;
        let key = Key(raw);
        let mut current = Vec::new();
        values(&key, &entry.key, &mut current)?;
        if !current.contains(entry) {
            return Err(Error::Conflict);
        }
        let name = wide(&entry.name);
        // SAFETY: one known named value on an owned handle; never deletes a tree.
        status(unsafe { RegDeleteValueW(key.0, name.as_ptr()) })
    }
    fn flush(&mut self) -> Result<(), Error> {
        if let Some(key) = self.root(false)? {
            // SAFETY: live owned handle. Synchronously persists the containing hive.
            status(unsafe { RegFlushKey(key.0) })?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        policy::{InputPolicy, PolicyBackend},
        recovery::Backend,
    };
    #[test]
    fn usb_hid_entry_validation_is_bounded_without_os_access() {
        assert!(valid_entry(&Entry::text(
            "DenyDeviceIDs",
            "1",
            "USB\\Class_03"
        )));
        for index in ["0", "2", "01"] {
            assert!(!valid_entry(&Entry::text(
                "DenyDeviceIDs",
                index,
                "USB\\Class_03"
            )));
        }
        for name in ["DenyDeviceIDs", "DenyDeviceIDsRetroactive"] {
            assert!(valid_entry(&Entry {
                key: String::new(),
                name: name.into(),
                kind: REG_DWORD,
                data: 1u32.to_le_bytes().to_vec()
            }));
        }
        assert!(valid_entry(&Entry::text(
            "DenyDeviceClasses",
            "3",
            "{4d36e96f-e325-11ce-bfc1-08002be10318}"
        )));
    }
    struct Fixture(String);
    impl Fixture {
        fn new() -> Self {
            let nonce = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            Self(format!(
                "Software\\SentinelUsbTests\\{}-{nonce}",
                std::process::id()
            ))
        }
        fn registry(&self) -> WindowsRegistry {
            WindowsRegistry {
                hive: HKEY_CURRENT_USER,
                path: self.0.clone(),
            }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            // SAFETY: only the exact unique test-owned nonpolicy HKCU subtree.
            unsafe {
                RegDeleteTreeW(HKEY_CURRENT_USER, wide(&self.0).as_ptr());
            }
        }
    }
    #[test]
    fn native_full_capacity_roundtrip_and_index_boundaries() {
        let fixture = Fixture::new();
        let ids: Vec<_> = (0..32)
            .map(|i| format!("HID\\SYNTHETIC\\BASELINE{i:02}"))
            .collect();
        let refs: Vec<_> = ids.iter().map(String::as_str).collect();
        let mut backend = PolicyBackend::new(fixture.registry(), InputPolicy::new(&refs).unwrap());
        let mut record = [0; 4072];
        let size = backend.capture_into(&mut record).unwrap();
        backend.apply_if_unchanged(&record[..size]).unwrap();
        backend.verify_applied().unwrap();
        assert_eq!(fixture.registry().snapshot().unwrap().len(), 38);
        backend.restore_if_owned(&record[..size]).unwrap();
        backend.verify_restored(&record[..size]).unwrap();
        let mut registry = fixture.registry();
        for (key, index) in [
            ("AllowInstanceIDs", "33"),
            ("AllowInstanceIDs", "01"),
            ("DenyDeviceClasses", "4"),
        ] {
            assert_eq!(
                registry.set(&Entry::text(key, index, "HID\\SYNTHETIC\\BOUNDARY")),
                Err(Error::Invalid)
            );
        }
        assert!(registry.snapshot().unwrap().is_empty());
    }
    #[test]
    fn native_roundtrip_uses_only_a_disposable_nonpolicy_hkcu_key() {
        let fixture = Fixture::new();
        let registry = fixture.registry();
        let mut backend = PolicyBackend::new(
            registry,
            InputPolicy::new(&["HID\\SYNTHETIC\\BASELINE"]).unwrap(),
        );
        let mut record = [0u8; 2048];
        let size = backend.capture_into(&mut record).unwrap();
        backend.apply_if_unchanged(&record[..size]).unwrap();
        backend.verify_applied().unwrap();
        backend.restore_if_owned(&record[..size]).unwrap();
        backend.verify_restored(&record[..size]).unwrap();
        backend.restore_if_owned(&record[..size]).unwrap();
        drop(backend);
    }
    #[test]
    fn native_provider_refuses_unknown_subkeys_and_oversized_values() {
        let fixture = Fixture::new();
        let mut registry = fixture.registry();
        let root = registry.root(true).unwrap().unwrap();
        let unknown = open_child(root.0, "Unowned", true).unwrap().unwrap();
        drop(unknown);
        assert!(matches!(registry.snapshot(), Err(Error::Conflict)));
        drop(root);
        drop(registry);
        drop(fixture);

        let fixture = Fixture::new();
        let mut registry = fixture.registry();
        let root = registry.root(true).unwrap().unwrap();
        let data = [0u8; 513];
        // SAFETY: bounded synthetic data on this test-owned nonpolicy key.
        status(unsafe {
            RegSetValueExW(
                root.0,
                wide("Unowned").as_ptr(),
                0,
                REG_BINARY,
                data.as_ptr(),
                data.len() as u32,
            )
        })
        .unwrap();
        assert!(registry.snapshot().is_err());
        drop(root);
    }
    #[test]
    fn native_provider_never_overwrites_an_existing_value() {
        let fixture = Fixture::new();
        let mut registry = fixture.registry();
        let entry = Entry {
            key: String::new(),
            name: "DenyDeviceClasses".into(),
            kind: REG_DWORD,
            data: 1u32.to_le_bytes().to_vec(),
        };
        registry.set(&entry).unwrap();
        assert_eq!(registry.set(&entry), Err(Error::Conflict));
        assert!(registry.snapshot().unwrap() == vec![entry]);
    }
}
