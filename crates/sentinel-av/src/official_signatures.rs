//! Optional native ClamAV 1.5.4 adapter. Only the owned native worker configures it.
//! Versioned ABI: Cisco-Talos/clamav/clamav-1.5.4/libclamav/clamav.h.
use serde::Serialize;

pub const MAX_FILE_BYTES: usize = 1024 * 1024 * 1024;
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignatureResult {
    pub state: &'static str,
    pub name: Option<String>,
    pub can_auto_quarantine: bool,
}
impl SignatureResult {
    pub fn error() -> Self {
        Self {
            state: "incomplete",
            name: None,
            can_auto_quarantine: false,
        }
    }
}
#[cfg(any(windows, test))]
fn classify(status: i32, verdict: i32, name: Option<String>, fresh: bool) -> SignatureResult {
    if status != 0 {
        let mut result = SignatureResult::error();
        result.name = Some(match status {
            21 => "Scan time limit reached".into(),
            23..=25 => "Expanded content safety limit reached".into(),
            _ => format!("Content could not be fully inspected (engine code {status})"),
        });
        return result;
    }
    let label = name.as_deref().unwrap_or("");
    let lower = label.to_ascii_lowercase();
    if lower.contains("limits.exceeded") {
        let mut result = SignatureResult::error();
        result.name = Some(format!("Content safety limit reached: {label}"));
        return result;
    }
    let test = lower.contains("eicar") || lower.contains("test") || lower.contains("simulation");
    let advisory = lower.starts_with("heuristics.")
        || lower.starts_with("pua.")
        || lower.contains(".unofficial");
    let state = match verdict {
        0 | 1 => "no_match",
        2 if test => "test_match",
        2 if advisory => "advisory",
        2 if !label.is_empty() => "signature_match",
        3 => "advisory",
        _ => return SignatureResult::error(),
    };
    SignatureResult {
        state,
        name,
        can_auto_quarantine: state == "signature_match" && fresh,
    }
}

#[cfg(windows)]
mod native {
    use super::*;
    use std::{
        ffi::{c_char, c_void, CStr, CString},
        io::Read,
        path::Path,
        ptr,
        time::{SystemTime, UNIX_EPOCH},
    };
    type Engine = *mut c_void;
    type Map = *mut c_void;
    #[repr(C)]
    struct Options {
        general: u32,
        parse: u32,
        heuristic: u32,
        mail: u32,
        dev: u32,
    }
    type Init = unsafe extern "C" fn(u32) -> i32;
    type New = unsafe extern "C" fn() -> Engine;
    type Free = unsafe extern "C" fn(Engine) -> i32;
    type Set = unsafe extern "C" fn(Engine, i32, i64) -> i32;
    type SetString = unsafe extern "C" fn(Engine, i32, *const c_char) -> i32;
    type Load = unsafe extern "C" fn(*const c_char, Engine, *mut u32, u32) -> i32;
    type Compile = unsafe extern "C" fn(Engine) -> i32;
    type Open = unsafe extern "C" fn(*const c_void, usize) -> Map;
    type Close = unsafe extern "C" fn(Map);
    type Scan = unsafe extern "C" fn(
        Map,
        *const c_char,
        *mut i32,
        *mut *const c_char,
        *mut u64,
        Engine,
        *mut Options,
        *mut c_void,
        *const c_char,
        *mut *mut c_char,
        *const c_char,
        *const c_char,
        *mut *mut c_char,
    ) -> i32;
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn LoadLibraryExW(path: *const u16, file: *mut c_void, flags: u32) -> *mut c_void;
        fn GetProcAddress(module: *mut c_void, name: *const u8) -> *mut c_void;
        fn FreeLibrary(module: *mut c_void) -> i32;
    }
    struct Library(*mut c_void);
    impl Drop for Library {
        fn drop(&mut self) {
            unsafe {
                FreeLibrary(self.0);
            }
        }
    }
    impl Library {
        fn symbol(&self, name: &'static [u8]) -> Result<*mut c_void, String> {
            let p = unsafe { GetProcAddress(self.0, name.as_ptr()) };
            if p.is_null() {
                Err("signature engine ABI unavailable".into())
            } else {
                Ok(p)
            }
        }
    }
    pub struct OfficialEngine {
        _library: Library,
        engine: Engine,
        free: Free,
        set: Set,
        open: Open,
        close: Close,
        scan: Scan,
        pub count: u32,
        pub built_at: u64,
    }
    impl Drop for OfficialEngine {
        fn drop(&mut self) {
            unsafe {
                (self.free)(self.engine);
            }
        }
    }
    impl OfficialEngine {
        pub fn load(directory: &Path, databases: &Path) -> Result<Self, String> {
            use std::os::windows::ffi::OsStrExt;
            if !directory.is_absolute() || !databases.is_absolute() {
                return Err("absolute native configuration required".into());
            }
            let dll = directory.join("libclamav.dll");
            let wide: Vec<u16> = dll.as_os_str().encode_wide().chain(Some(0)).collect();
            // Resolve dependencies only beside the pinned DLL and in System32.
            let module = unsafe { LoadLibraryExW(wide.as_ptr(), ptr::null_mut(), 0x100 | 0x800) };
            if module.is_null() {
                return Err("signature library unavailable".into());
            }
            let library = Library(module);
            macro_rules! symbol {
                ($name:literal,$kind:ty) => {
                    unsafe {
                        std::mem::transmute::<*mut c_void, $kind>(
                            library.symbol(concat!($name, "\0").as_bytes())?,
                        )
                    }
                };
            }
            let init = symbol!("cl_init", Init);
            let new = symbol!("cl_engine_new", New);
            let free = symbol!("cl_engine_free", Free);
            let set = symbol!("cl_engine_set_num", Set);
            let set_string = symbol!("cl_engine_set_str", SetString);
            let load = symbol!("cl_load", Load);
            let compile = symbol!("cl_engine_compile", Compile);
            let open = symbol!("cl_fmap_open_memory", Open);
            let close = symbol!("cl_fmap_close", Close);
            let scan = symbol!("cl_scanmap_ex", Scan);
            if unsafe { init(0) } != 0 {
                return Err("signature engine initialization failed".into());
            }
            let engine = unsafe { new() };
            if engine.is_null() {
                return Err("signature engine allocation failed".into());
            }
            let mut result = Self {
                _library: library,
                engine,
                free,
                set,
                open,
                close,
                scan,
                count: 0,
                built_at: 0,
            };
            // Verified Windows 1.5.4 package header: CL_ENGINE_CVDCERTSDIR=37.
            let certificates = directory.join("certs");
            let certificates =
                CString::new(certificates.to_str().ok_or("certificate path encoding")?)
                    .map_err(|_| "certificate path encoding")?;
            if unsafe { set_string(engine, 37, certificates.as_ptr()) } != 0 {
                return Err("signature certificate directory configuration failed".into());
            }
            for (field, value) in [
                (0, 2 * 1024 * 1024 * 1024i64),
                (1, MAX_FILE_BYTES as i64),
                (2, 24),
                (3, 10000),
                (31, 30000),
            ] {
                if unsafe { set(engine, field, value) } != 0 {
                    return Err("signature limit configuration failed".into());
                }
            }
            for name in ["main.cvd", "daily.cvd"] {
                let path = databases.join(name);
                let filename = CString::new(path.to_str().ok_or("signature path encoding")?)
                    .map_err(|_| "signature path encoding")?;
                let previous = result.count;
                // Official signed databases only, no unsigned/custom bytecode or YARA feed.
                let status =
                    unsafe { load(filename.as_ptr(), engine, &mut result.count, 0x1000 | 0xA) };
                if status != 0 || result.count <= previous {
                    return Err(format!(
                        "official signature database verification failed ({status})"
                    ));
                }
                let mut header = [0u8; 512];
                std::fs::File::open(path)
                    .and_then(|mut f| f.read_exact(&mut header))
                    .map_err(|_| "signature header unavailable")?;
                let text = String::from_utf8_lossy(&header);
                let fields: Vec<_> = text
                    .trim_matches(|c: char| c == '\0' || c.is_whitespace())
                    .split(':')
                    .collect();
                let built = fields
                    .get(8)
                    .and_then(|v| v.trim().parse::<u64>().ok())
                    .ok_or("signature database time unavailable")?;
                result.built_at = result.built_at.max(built);
            }
            if unsafe { compile(engine) } != 0 {
                return Err("signature compilation failed".into());
            }
            Ok(result)
        }
        pub fn fresh(&self) -> bool {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|v| v.as_secs())
                .unwrap_or(0);
            now >= self.built_at && now - self.built_at <= 7 * 86400
        }
        pub fn scan(&self, bytes: &[u8]) -> SignatureResult {
            if bytes.len() > MAX_FILE_BYTES {
                return SignatureResult::error();
            }
            if bytes.is_empty() {
                return classify(0, 0, None, self.fresh());
            }
            // Larger immutable/read-only inputs get a bounded deep-scan budget.
            // The engine is used serially by its owning worker, never concurrently.
            let milliseconds = if bytes.len() > 64 * 1024 * 1024 {
                120000
            } else {
                30000
            };
            if unsafe { (self.set)(self.engine, 31, milliseconds) } != 0 {
                return SignatureResult::error();
            }

            let map = unsafe { (self.open)(bytes.as_ptr().cast(), bytes.len()) };
            if map.is_null() {
                return SignatureResult::error();
            }
            let mut verdict = 0;
            let mut alert = ptr::null();
            let mut scanned = 0u64;
            let mut options = Options {
                general: 4,
                parse: 0xfff,
                heuristic: 4,
                mail: 0,
                dev: 0,
            };
            let status = unsafe {
                (self.scan)(
                    map,
                    ptr::null(),
                    &mut verdict,
                    &mut alert,
                    &mut scanned,
                    self.engine,
                    &mut options,
                    ptr::null_mut(),
                    ptr::null(),
                    ptr::null_mut(),
                    ptr::null(),
                    ptr::null(),
                    ptr::null_mut(),
                )
            };
            // Alert is library-owned. Copy it before closing the map or freeing the engine.
            let name = if alert.is_null() {
                None
            } else {
                Some(
                    unsafe { CStr::from_ptr(alert) }
                        .to_string_lossy()
                        .chars()
                        .take(192)
                        .collect(),
                )
            };
            unsafe {
                (self.close)(map);
            }
            classify(status, verdict, name, self.fresh())
        }
    }
}
#[cfg(windows)]
pub use native::OfficialEngine;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn verdict_and_status_are_separate() {
        let hit = classify(0, 2, Some("Win.Trojan.Example-123".into()), true);
        assert_eq!(hit.state, "signature_match");
        assert!(hit.can_auto_quarantine);
        assert!(!classify(1, 2, Some("Win.Trojan.Example".into()), true).can_auto_quarantine);
    }
    #[test]
    fn tests_pua_heuristics_and_stale_definitions_never_authorize_removal() {
        for (verdict, name) in [
            (2, "Eicar-Signature"),
            (2, "Heuristics.Encrypted.Zip"),
            (3, "PUA.Tool"),
            (2, "Private.UNOFFICIAL"),
        ] {
            assert!(!classify(0, verdict, Some(name.into()), true).can_auto_quarantine);
        }
        assert!(!classify(0, 2, Some("Win.Trojan.Example".into()), false).can_auto_quarantine);
        assert_eq!(classify(0, 0, None, true).state, "no_match");
        assert_eq!(
            classify(0, 2, Some("Heuristics.Limits.Exceeded".into()), true).state,
            "incomplete"
        );
    }
}
