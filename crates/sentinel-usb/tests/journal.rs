use sentinel_usb::journal::JournalStore;
use sentinel_usb::recovery::{Backend, Error, Recovery, State, Store};
use std::{
    cell::Cell,
    fs::{File, OpenOptions},
    io::{Seek, SeekFrom, Write},
    path::PathBuf,
    rc::Rc,
    sync::atomic::{AtomicU64, Ordering},
};
static NEXT: AtomicU64 = AtomicU64::new(0);
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let p = std::env::temp_dir().join(format!(
            "sentinel-usb-journal-{}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        OpenOptions::new()
            .create_new(true)
            .read(true)
            .write(true)
            .open(&p)
            .unwrap();
        Self(p)
    }
    fn file(&self) -> File {
        OpenOptions::new()
            .read(true)
            .write(true)
            .open(&self.0)
            .unwrap()
    }
    fn store(&self) -> JournalStore {
        JournalStore::from_trusted_file(self.file()).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}
#[test]
fn durable_roundtrip_reopen_and_clear() {
    let f = Fixture::new();
    let mut store = f.store();
    let mut out = [0; 4096];
    assert_eq!(store.load_into(&mut out), Ok(None));
    store.persist(b"synthetic recovery record").unwrap();
    drop(store);
    let mut store = f.store();
    assert_eq!(store.load_into(&mut out), Ok(Some(25)));
    assert_eq!(&out[..25], b"synthetic recovery record");
    store.clear().unwrap();
    drop(store);
    assert_eq!(f.store().load_into(&mut out), Ok(None));
}
#[test]
fn actual_os_lock_refuses_second_open_until_owner_drops() {
    let f = Fixture::new();
    let store = f.store();
    assert!(matches!(
        JournalStore::from_trusted_file(f.file()),
        Err(Error::Busy)
    ));
    drop(store);
    let _second = f.store();
}
#[test]
fn existing_record_cannot_be_overwritten() {
    let f = Fixture::new();
    let mut store = f.store();
    store.persist(b"first").unwrap();
    assert_eq!(store.persist(b"replacement"), Err(Error::Busy));
    let mut out = [0; 4096];
    assert_eq!(store.load_into(&mut out), Ok(Some(5)));
    assert_eq!(&out[..5], b"first");
}
#[test]
fn invalid_size_and_small_output_do_not_disclose_or_modify() {
    let f = Fixture::new();
    let mut store = f.store();
    assert_eq!(store.persist(&[]), Err(Error::Invalid));
    assert_eq!(store.persist(&[0; 4097]), Err(Error::Invalid));
    store.persist(&[7; 4096]).unwrap();
    let mut out = [9; 4];
    assert_eq!(store.load_into(&mut out), Err(Error::Invalid));
    assert_eq!(out, [9; 4]);
}
#[test]
fn header_checksum_payload_truncation_and_trailing_bytes_refuse_on_reopen() {
    for damage in 0..6 {
        let f = Fixture::new();
        let mut store = f.store();
        store.persist(b"synthetic").unwrap();
        drop(store);
        let mut file = f.file();
        match damage {
            0 => {
                file.seek(SeekFrom::Start(0)).unwrap();
                file.write_all(b"X").unwrap();
            }
            1 => {
                file.seek(SeekFrom::Start(8)).unwrap();
                file.write_all(&u32::MAX.to_le_bytes()).unwrap();
            }
            2 => {
                file.seek(SeekFrom::Start(12)).unwrap();
                file.write_all(&[0; 32]).unwrap();
            }
            3 => {
                file.seek(SeekFrom::Start(44)).unwrap();
                file.write_all(b"X").unwrap();
            }
            4 => {
                file.set_len(45).unwrap();
            }
            _ => {
                file.seek(SeekFrom::End(0)).unwrap();
                file.write_all(b"X").unwrap();
            }
        }
        file.sync_all().unwrap();
        drop(file);
        assert!(matches!(
            JournalStore::from_trusted_file(f.file()),
            Err(Error::Corrupt)
        ));
    }
}
#[test]
fn oversized_file_refuses_before_record_read() {
    let f = Fixture::new();
    f.file().set_len(4141).unwrap();
    assert!(matches!(
        JournalStore::from_trusted_file(f.file()),
        Err(Error::Corrupt)
    ));
}
struct Platform {
    applied: Rc<Cell<bool>>,
    fail_restore: bool,
}
impl Backend for Platform {
    fn capture_into(&mut self, out: &mut [u8]) -> Result<usize, Error> {
        out[..4].copy_from_slice(b"base");
        Ok(4)
    }
    fn apply_if_unchanged(&mut self, prior: &[u8]) -> Result<(), Error> {
        assert_eq!(prior, b"base");
        self.applied.set(true);
        Ok(())
    }
    fn verify_applied(&mut self) -> Result<(), Error> {
        assert!(self.applied.get());
        Ok(())
    }
    fn restore_if_owned(&mut self, prior: &[u8]) -> Result<(), Error> {
        assert_eq!(prior, b"base");
        if self.fail_restore {
            return Err(Error::Platform);
        }
        self.applied.set(false);
        Ok(())
    }
    fn verify_restored(&mut self, _: &[u8]) -> Result<(), Error> {
        assert!(!self.applied.get());
        Ok(())
    }
}
#[test]
fn recovery_reopens_actual_journal_and_clears_only_after_verified_restoration() {
    let f = Fixture::new();
    let applied = Rc::new(Cell::new(false));
    let mut recovery = Recovery::new(
        f.store(),
        Platform {
            applied: applied.clone(),
            fail_restore: false,
        },
    );
    recovery.recover_pending().unwrap();
    recovery.arm_apply(100, 30).unwrap();
    assert!(applied.get());
    drop(recovery);
    let mut recovery = Recovery::new(
        f.store(),
        Platform {
            applied: applied.clone(),
            fail_restore: true,
        },
    );
    assert_eq!(recovery.recover_pending(), Err(Error::Platform));
    assert!(applied.get());
    drop(recovery);
    let mut recovery = Recovery::new(
        f.store(),
        Platform {
            applied: applied.clone(),
            fail_restore: false,
        },
    );
    assert_eq!(recovery.recover_pending(), Ok(true));
    assert!(!applied.get());
    assert_eq!(recovery.state(), State::Idle);
    drop(recovery);
    assert_eq!(std::fs::metadata(&f.0).unwrap().len(), 0);
}
#[test]
fn unwritable_journal_prevents_policy_mutation() {
    let f = Fixture::new();
    let file = File::open(&f.0).unwrap();
    let Ok(store) = JournalStore::from_trusted_file(file) else {
        return;
    }; // Some platforms refuse exclusive locks on read-only handles.
    let applied = Rc::new(Cell::new(false));
    let mut recovery = Recovery::new(
        store,
        Platform {
            applied: applied.clone(),
            fail_restore: false,
        },
    );
    recovery.recover_pending().unwrap();
    assert!(recovery.arm_apply(100, 30).is_err());
    assert!(!applied.get());
}
