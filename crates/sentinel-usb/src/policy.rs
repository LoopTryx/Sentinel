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

const MAX_APPROVALS: usize = 8;
const MAX_ID: usize = 200;
const MAGIC: &[u8; 8] = b"SNTINP01";

/// Trusted native enumeration/approval supplies exact instance IDs, never a
/// browser-provided allowlist. No Debug/serialization exposes those identifiers.
pub struct InputPolicy {
    approved: Vec<String>,
}
impl InputPolicy {
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
        Ok(Self { approved })
    }
    fn encode(&self, out: &mut [u8]) -> Result<usize, Error> {
        let size = 9 + self.approved.iter().map(|id| 1 + id.len()).sum::<usize>();
        if out.len() < size {
            return Err(Error::Invalid);
        }
        out[..8].copy_from_slice(MAGIC);
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
        if bytes.len() < 9 || &bytes[..8] != MAGIC || !(1..=8).contains(&bytes[8]) {
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
        Self::new(&ids).map_err(|_| Error::Corrupt)
    }
    fn entries(&self) -> Vec<Entry> {
        let mut entries = Vec::with_capacity(8 + self.approved.len());
        // Prepare exceptions before enabling the deny switch; reverse-order
        // recovery removes the deny switch before removing input exceptions.
        for (i, id) in self.approved.iter().enumerate() {
            entries.push(Entry::text("AllowInstanceIDs", &(i + 1).to_string(), id));
        }
        for (i, class) in [
            "{745a17a0-74d3-11d0-b6fe-00a0c90f57da}", // HIDClass
            "{4d36e96b-e325-11ce-bfc1-08002be10318}", // Keyboard
            "{4d36e96f-e325-11ce-bfc1-08002be10318}", // Mouse
        ]
        .iter()
        .enumerate()
        {
            entries.push(Entry::text(
                "DenyDeviceClasses",
                &(i + 1).to_string(),
                class,
            ));
        }
        for name in [
            "AllowDenyLayered",
            "AllowInstanceIDs",
            "DenyDeviceClassesRetroactive",
            "DenyDeviceClasses",
        ] {
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
        if entries.len() > 32
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
        InputPolicy::decode(prior)?;
        self.matches(&[])
    }
}
