//! Fixed Windows input-device policy profile and recovery adapter.
//!
//! Registry configuration is NOT measured pre-input protection. The trusted broker
//! must validate OS support, baseline devices, authorization and an independent
//! recovery watchdog before invoking this backend. No application invokes it yet.
//! Setup-class restrictions affect non-USB input devices too. Instance IDs can be
//! spoofed; neither an ID nor a quiet sandbox observation establishes trust.
use crate::recovery::{Backend, Error};

#[cfg(windows)]
pub mod windows;

const MAX_APPROVALS: usize = 32;
const MAX_ENTRIES: usize = MAX_APPROVALS + 7;
const MAX_ENCODED: usize = 4072; // 4096-byte durable record minus recovery's 24-byte header.
const MAX_ID: usize = 200;
const MAGIC: &[u8; 8] = b"SNTINP02";
const LEGACY_MAGIC: &[u8; 8] = b"SNTINP01";
const USB_MAGIC: &[u8; 8] = b"SNTINP03";
const EXACT_USB_MAGIC: &[u8; 8] = b"SNTINP04";

#[derive(Clone, Copy, PartialEq, Eq)]
enum Scope {
    KeyboardMouse,
    LegacyAllHid,
    UsbHid,
    ExactUsbInstances,
}

/// Trusted native enumeration/approval supplies exact instance IDs, never a
/// browser-provided allowlist. No Debug/serialization exposes those identifiers.
pub struct InputPolicy {
    approved: Vec<String>,
    scope: Scope,
}

/// Compile a bounded policy record into its canonical versioned owned delta.
/// Read-only: this does not authenticate a caller or mutate Windows policy.
pub fn entries_from_record(record: &[u8]) -> Result<Vec<Entry>, Error> {
    Ok(InputPolicy::decode(record)?.entries())
}
impl InputPolicy {
    /// Candidate USB HID compatible-ID restriction. Approvals must come from
    /// authenticated native enrollment; syntactically valid IDs are not trust.
    pub fn usb_hid(ids: &[&str]) -> Result<Self, Error> {
        let mut policy = Self::new(ids)?;
        policy.scope = Scope::UsbHid;
        Ok(policy)
    }
    /// Exact deny subjects only; this does not establish external-device identity
    /// or authorize mutation. Native enrollment must reject protected inputs.
    pub fn blocked_usb_instances(ids: &[&str]) -> Result<Self, Error> {
        let mut policy = Self::new(ids)?;
        if policy.approved.iter().any(|id| {
            !id.as_bytes()
                .get(..8)
                .is_some_and(|prefix| prefix.eq_ignore_ascii_case(b"USB\\VID_"))
        }) {
            return Err(Error::Invalid);
        }
        policy.scope = Scope::ExactUsbInstances;
        Ok(policy)
    }
    pub fn new(ids: &[&str]) -> Result<Self, Error> {
        if ids.is_empty() || ids.len() > MAX_APPROVALS {
            return Err(Error::Invalid);
        }
        let mut approved: Vec<String> = Vec::with_capacity(ids.len());
        for id in ids {
            if id.len() > MAX_ID
                || !id
                    .bytes()
                    .all(|b| b.is_ascii_graphic() && !b"*?/\"<>|".contains(&b))
                || id.split('\\').count() != 3
                || id.split('\\').any(|part| part.is_empty())
                || approved.iter().any(|other| other.eq_ignore_ascii_case(id))
            {
                return Err(Error::Invalid);
            }
            approved.push((*id).to_owned());
        }
        if 9 + approved.iter().map(|id| 1 + id.len()).sum::<usize>() > MAX_ENCODED {
            return Err(Error::Invalid);
        }
        Ok(Self {
            approved,
            scope: Scope::KeyboardMouse,
        })
    }
    fn encode(&self, out: &mut [u8]) -> Result<usize, Error> {
        let size = 9 + self.approved.iter().map(|id| 1 + id.len()).sum::<usize>();
        if out.len() < size || size > MAX_ENCODED {
            return Err(Error::Invalid);
        }
        out[..8].copy_from_slice(match self.scope {
            Scope::KeyboardMouse => MAGIC,
            Scope::LegacyAllHid => LEGACY_MAGIC,
            Scope::UsbHid => USB_MAGIC,
            Scope::ExactUsbInstances => EXACT_USB_MAGIC,
        });
        out[8] = self.approved.len() as u8;
        let mut offset = 9;
        for id in &self.approved {
            out[offset] = id.len() as u8;
            offset += 1;
            out[offset..offset + id.len()].copy_from_slice(id.as_bytes());
            offset += id.len();
        }
        Ok(offset)
    }
    fn decode(bytes: &[u8]) -> Result<Self, Error> {
        if !(9..=MAX_ENCODED).contains(&bytes.len())
            || (&bytes[..8] != MAGIC
                && &bytes[..8] != LEGACY_MAGIC
                && &bytes[..8] != USB_MAGIC
                && &bytes[..8] != EXACT_USB_MAGIC)
            || !(1..=MAX_APPROVALS as u8).contains(&bytes[8])
        {
            return Err(Error::Corrupt);
        }
        let mut ids = Vec::with_capacity(bytes[8] as usize);
        let mut offset = 9;
        for _ in 0..bytes[8] {
            let length = *bytes.get(offset).ok_or(Error::Corrupt)? as usize;
            offset += 1;
            let id = bytes.get(offset..offset + length).ok_or(Error::Corrupt)?;
            ids.push(std::str::from_utf8(id).map_err(|_| Error::Corrupt)?);
            offset += length;
        }
        if offset != bytes.len() {
            return Err(Error::Corrupt);
        }
        if &bytes[..8] == EXACT_USB_MAGIC {
            return Self::blocked_usb_instances(&ids).map_err(|_| Error::Corrupt);
        }
        let mut policy = Self::new(&ids).map_err(|_| Error::Corrupt)?;
        if &bytes[..8] == LEGACY_MAGIC {
            policy.scope = Scope::LegacyAllHid;
        } else if &bytes[..8] == USB_MAGIC {
            policy.scope = Scope::UsbHid;
        }
        Ok(policy)
    }
    fn entries(&self) -> Vec<Entry> {
        let mut entries = Vec::with_capacity(8 + self.approved.len());
        if self.scope == Scope::ExactUsbInstances {
            for (i, id) in self.approved.iter().enumerate() {
                entries.push(Entry::text("DenyInstanceIDs", &(i + 1).to_string(), id));
            }
            for name in ["DenyInstanceIDsRetroactive", "DenyInstanceIDs"] {
                entries.push(Entry {
                    key: String::new(),
                    name: name.to_owned(),
                    kind: 4,
                    data: 1u32.to_le_bytes().to_vec(),
                });
            }
            return entries;
        }
        // Prepare exceptions before enabling the deny switch; reverse-order
        // recovery removes the deny switch before removing input exceptions.
        for (i, id) in self.approved.iter().enumerate() {
            entries.push(Entry::text("AllowInstanceIDs", &(i + 1).to_string(), id));
        }
        let classes = [
            "{745a17a0-74d3-11d0-b6fe-00a0c90f57da}", // HIDClass
            "{4d36e96b-e325-11ce-bfc1-08002be10318}", // Keyboard
            "{4d36e96f-e325-11ce-bfc1-08002be10318}", // Mouse
        ];
        let classes = match self.scope {
            Scope::LegacyAllHid => &classes[..],
            Scope::KeyboardMouse => &classes[1..],
            Scope::UsbHid | Scope::ExactUsbInstances => &classes[0..0],
        };
        for (i, class) in classes.iter().enumerate() {
            entries.push(Entry::text(
                "DenyDeviceClasses",
                &(i + 1).to_string(),
                class,
            ));
        }
        if self.scope == Scope::UsbHid {
            entries.push(Entry::text("DenyDeviceIDs", "1", "USB\\Class_03"));
        }
        let (retroactive, deny) = if self.scope == Scope::UsbHid {
            ("DenyDeviceIDsRetroactive", "DenyDeviceIDs")
        } else {
            ("DenyDeviceClassesRetroactive", "DenyDeviceClasses")
        };
        for name in ["AllowDenyLayered", "AllowInstanceIDs", retroactive, deny] {
            entries.push(Entry {
                key: String::new(),
                name: name.to_owned(),
                kind: 4,
                data: 1u32.to_le_bytes().to_vec(),
            });
        }
        entries
    }
}

/// Bounded registry snapshot values. Deliberately not Debug to avoid device IDs in logs.
#[derive(Clone, PartialEq, Eq)]
pub struct Entry {
    pub key: String,
    pub name: String,
    pub kind: u32,
    pub data: Vec<u8>,
}
impl Entry {
    fn text(key: &str, name: &str, text: &str) -> Self {
        Self {
            key: key.into(),
            name: name.into(),
            kind: 1,
            data: text
                .encode_utf16()
                .chain([0])
                .flat_map(u16::to_le_bytes)
                .collect(),
        }
    }
}
/// Internal provider seam, not an IPC surface. Implementors must bound all reads,
/// reject unknown subkeys/links and flush durable mutations. Broker serializes use.
pub trait Registry {
    fn snapshot(&mut self) -> Result<Vec<Entry>, Error>;
    fn set(&mut self, entry: &Entry) -> Result<(), Error>;
    fn remove(&mut self, entry: &Entry) -> Result<(), Error>;
    fn flush(&mut self) -> Result<(), Error>;
}
pub struct PolicyBackend<R: Registry> {
    registry: R,
    policy: InputPolicy,
}
impl<R: Registry> PolicyBackend<R> {
    pub fn new(registry: R, policy: InputPolicy) -> Self {
        Self { registry, policy }
    }
    fn snapshot(&mut self) -> Result<Vec<Entry>, Error> {
        let entries = self.registry.snapshot()?;
        if entries.len() > MAX_ENTRIES
            || entries
                .iter()
                .any(|e| e.key.len() > 32 || e.name.len() > 64 || e.data.len() > 512)
        {
            return Err(Error::Invalid);
        }
        for (i, entry) in entries.iter().enumerate() {
            if entries[..i].iter().any(|other| {
                other.key.eq_ignore_ascii_case(&entry.key)
                    && other.name.eq_ignore_ascii_case(&entry.name)
            }) {
                return Err(Error::Conflict);
            }
        }
        Ok(entries)
    }
    fn matches(&mut self, wanted: &[Entry]) -> Result<(), Error> {
        let current = self.snapshot()?;
        if current.len() != wanted.len() || current.iter().any(|entry| !wanted.contains(entry)) {
            return Err(Error::Conflict);
        }
        Ok(())
    }
    fn restore_restrictive(&mut self, record: &[u8]) -> Result<(), Error> {
        let (baseline, next) = RestrictiveApprovalBackend::<R>::decode(record)?;
        let base_entries = baseline.entries();
        let next_entries = next.entries();
        let mut current = self.snapshot()?;
        if base_entries.iter().any(|entry| !current.contains(entry))
            || current.iter().any(|entry| !next_entries.contains(entry))
        {
            return Err(Error::Conflict);
        }
        for entry in next_entries[baseline.approved.len()..next.approved.len()]
            .iter()
            .rev()
        {
            self.matches(&current)?;
            if let Some(index) = current.iter().position(|item| item == entry) {
                self.registry.remove(entry)?;
                current.remove(index);
            }
        }
        self.registry.flush()
    }
}
impl<R: Registry> Backend for PolicyBackend<R> {
    fn capture_into(&mut self, prior: &mut [u8]) -> Result<usize, Error> {
        // We support only an empty policy namespace, never merge with or replace
        // administrator/MDM rules. The record encodes the full expected owned delta.
        self.matches(&[])?;
        self.policy.encode(prior)
    }
    fn apply_if_unchanged(&mut self, prior: &[u8]) -> Result<(), Error> {
        let desired = InputPolicy::decode(prior)?.entries();
        if desired != self.policy.entries() {
            return Err(Error::Conflict);
        }
        self.matches(&[])?;
        for (i, entry) in desired.iter().enumerate() {
            self.matches(&desired[..i])?;
            self.registry.set(entry)?;
        }
        self.registry.flush()
    }
    fn verify_applied(&mut self) -> Result<(), Error> {
        self.matches(&self.policy.entries())
    }
    fn restore_if_owned(&mut self, prior: &[u8]) -> Result<(), Error> {
        if prior.starts_with(b"SNTLKG01") {
            return self.restore_restrictive(prior);
        }
        let desired = InputPolicy::decode(prior)?.entries();
        let current = self.snapshot()?;
        if current.iter().any(|entry| !desired.contains(entry)) {
            return Err(Error::Conflict);
        }
        let mut expected = current;
        for entry in desired.iter().rev() {
            self.matches(&expected)?;
            if let Some(index) = expected.iter().position(|e| e == entry) {
                self.registry.remove(entry)?;
                expected.remove(index);
            }
        }
        self.registry.flush()
    }
    fn verify_restored(&mut self, prior: &[u8]) -> Result<(), Error> {
        if prior.starts_with(b"SNTLKG01") {
            let (baseline, _) = RestrictiveApprovalBackend::<R>::decode(prior)?;
            return self.matches(&baseline.entries());
        }
        InputPolicy::decode(prior)?;
        self.matches(&[])
    }
}

/// Append-only approval update over an already verified restrictive profile.
/// Recovery removes only the new exceptions; existing deny switches and baseline
/// exceptions remain present throughout. This is not first-install provisioning,
/// arbitrary policy replacement, authentication, or hardware containment proof.
pub struct RestrictiveApprovalBackend<R: Registry> {
    inner: PolicyBackend<R>,
    baseline: InputPolicy,
}
impl<R: Registry> RestrictiveApprovalBackend<R> {
    pub fn new(registry: R, baseline: InputPolicy, next: InputPolicy) -> Result<Self, Error> {
        if next.scope != baseline.scope
            || next.approved.len() <= baseline.approved.len()
            || !next.approved.starts_with(&baseline.approved)
            || 18 + next.approved.iter().map(|id| 1 + id.len()).sum::<usize>() > MAX_ENCODED
        {
            return Err(Error::Invalid);
        }
        Ok(Self {
            inner: PolicyBackend::new(registry, next),
            baseline,
        })
    }
    fn decode(record: &[u8]) -> Result<(InputPolicy, InputPolicy), Error> {
        if record.len() < 18 || record.len() > MAX_ENCODED || &record[..8] != b"SNTLKG01" {
            return Err(Error::Corrupt);
        }
        let next = InputPolicy::decode(&record[9..])?;
        let count = usize::from(record[8]);
        if count == 0 || count >= next.approved.len() {
            return Err(Error::Corrupt);
        }
        let ids: Vec<_> = next.approved[..count].iter().map(String::as_str).collect();
        let mut baseline = InputPolicy::new(&ids).map_err(|_| Error::Corrupt)?;
        baseline.scope = next.scope;
        Ok((baseline, next))
    }
}
impl<R: Registry> Backend for RestrictiveApprovalBackend<R> {
    fn capture_into(&mut self, out: &mut [u8]) -> Result<usize, Error> {
        self.inner.matches(&self.baseline.entries())?;
        if out.len() < 18 {
            return Err(Error::Invalid);
        }
        out[..8].copy_from_slice(b"SNTLKG01");
        out[8] = self.baseline.approved.len() as u8;
        let size = self.inner.policy.encode(&mut out[9..])?;
        Ok(size + 9)
    }
    fn apply_if_unchanged(&mut self, record: &[u8]) -> Result<(), Error> {
        let (baseline, next) = Self::decode(record)?;
        if baseline.scope != self.baseline.scope
            || next.scope != self.inner.policy.scope
            || baseline.approved != self.baseline.approved
            || next.approved != self.inner.policy.approved
        {
            return Err(Error::Conflict);
        }
        let mut expected = baseline.entries();
        self.inner.matches(&expected)?;
        let entries = next.entries();
        for entry in &entries[baseline.approved.len()..next.approved.len()] {
            self.inner.matches(&expected)?;
            self.inner.registry.set(entry)?;
            expected.push(entry.clone());
        }
        self.inner.registry.flush()
    }
    fn verify_applied(&mut self) -> Result<(), Error> {
        self.inner.matches(&self.inner.policy.entries())
    }
    fn restore_if_owned(&mut self, record: &[u8]) -> Result<(), Error> {
        self.inner.restore_restrictive(record)
    }
    fn verify_restored(&mut self, record: &[u8]) -> Result<(), Error> {
        let (baseline, _) = Self::decode(record)?;
        self.inner.matches(&baseline.entries())
    }
}
