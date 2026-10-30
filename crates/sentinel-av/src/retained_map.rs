//! Read-only mapping of an already retained file. No path reopen, writable view,
//! eager file-sized allocation, or ownership of the original file handle.
use std::{ffi::c_void, fs::File, marker::PhantomData, os::windows::io::AsRawHandle, ptr};
#[link(name = "kernel32")]
unsafe extern "system" {
    fn CreateFileMappingW(
        file: *mut c_void,
        security: *mut c_void,
        protect: u32,
        high: u32,
        low: u32,
        name: *const u16,
    ) -> *mut c_void;
    fn MapViewOfFile(
        mapping: *mut c_void,
        access: u32,
        high: u32,
        low: u32,
        length: usize,
    ) -> *mut c_void;
    fn UnmapViewOfFile(address: *const c_void) -> i32;
    fn CloseHandle(handle: *mut c_void) -> i32;
}
pub(crate) struct RetainedMap<'a> {
    view: *mut c_void,
    mapping: *mut c_void,
    length: usize,
    _file: PhantomData<&'a File>,
}
impl<'a> RetainedMap<'a> {
    pub(crate) fn new(file: &'a File, length: usize) -> std::io::Result<Self> {
        if length == 0 {
            return Ok(Self {
                view: ptr::null_mut(),
                mapping: ptr::null_mut(),
                length,
                _file: PhantomData,
            });
        }
        let mapping = unsafe {
            CreateFileMappingW(file.as_raw_handle(), ptr::null_mut(), 2, 0, 0, ptr::null())
        };
        if mapping.is_null() {
            return Err(std::io::Error::last_os_error());
        }
        let view = unsafe { MapViewOfFile(mapping, 4, 0, 0, length) };
        if view.is_null() {
            let error = std::io::Error::last_os_error();
            unsafe {
                CloseHandle(mapping);
            }
            return Err(error);
        }
        Ok(Self {
            view,
            mapping,
            length,
            _file: PhantomData,
        })
    }
    pub(crate) fn bytes(&self) -> &[u8] {
        if self.length == 0 {
            &[]
        } else {
            unsafe { std::slice::from_raw_parts(self.view.cast(), self.length) }
        }
    }
}
impl Drop for RetainedMap<'_> {
    fn drop(&mut self) {
        unsafe {
            if !self.view.is_null() {
                UnmapViewOfFile(self.view);
            }
            if !self.mapping.is_null() {
                CloseHandle(self.mapping);
            }
        }
    }
}
