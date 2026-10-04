//! Native-only storage for one picker-approved path. Not a remote command API.
//! References are correlation, not secrets, filesystem identity or authority.
use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

static NEXT_REFERENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SelectionKind {
    File,
    Directory,
}

pub struct ApprovedSelection {
    path: PathBuf,
    kind: SelectionKind,
}
impl ApprovedSelection {
    pub fn path(&self) -> &Path {
        &self.path
    }
    pub fn kind(&self) -> SelectionKind {
        self.kind
    }
}
impl std::fmt::Debug for ApprovedSelection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ApprovedSelection")
            .field("kind", &self.kind)
            .finish_non_exhaustive()
    }
}

#[derive(Default)]
pub struct NativeSelectionRegistry {
    current: Option<(String, ApprovedSelection)>,
}
impl std::fmt::Debug for NativeSelectionRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeSelectionRegistry")
            .field("has_selection", &self.current.is_some())
            .finish_non_exhaustive()
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct InvalidNativeSelection;
impl std::fmt::Display for InvalidNativeSelection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("invalid native selection")
    }
}
impl std::error::Error for InvalidNativeSelection {}

impl NativeSelectionRegistry {
    pub fn new() -> Self {
        Self::default()
    }
    /// Trusted native picker caller only. Never expose this path argument to IPC.
    /// Every attempt invalidates the prior selection, including rejected input.
    pub fn register_native_selection(
        &mut self,
        path: PathBuf,
        kind: SelectionKind,
    ) -> Result<String, InvalidNativeSelection> {
        self.clear();
        if !path.is_absolute()
            || path.as_os_str().len() > 32768
            || path.as_os_str().is_empty()
            || path.to_string_lossy().contains('\0')
        {
            return Err(InvalidNativeSelection);
        }
        let sequence = NEXT_REFERENCE
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |value| {
                value.checked_add(1)
            })
            .map_err(|_| InvalidNativeSelection)?;
        let reference = format!("selection-{sequence}");
        self.current = Some((reference.clone(), ApprovedSelection { path, kind }));
        Ok(reference)
    }
    /// Borrow keeps replacement mutually exclusive in safe Rust. A future
    /// dispatcher must separately cancel/join workers retaining path copies.
    pub fn resolve(&self, reference: &str) -> Option<&ApprovedSelection> {
        let (current, selection) = self.current.as_ref()?;
        (current == reference).then_some(selection)
    }
    pub fn clear(&mut self) {
        self.current = None;
    }
}
