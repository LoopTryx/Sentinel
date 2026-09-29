# Implementation status

Updated: 2026-09-29

| Task | State | Evidence |
| --- | --- | --- |
| T00 Capability and threat-model dossier | In progress; hardware probes deferred | Initial host inventory and untested capability matrix in `docs/evidence/capability-matrix.md`; owner reports no disposable Windows 11 machine or owned USB/HID test equipment |
| T01 Contracts, jobs, functional shell | In progress | Rust contracts, generated TS bindings, shared CLI/UI fixture, and CI added; final verification pending |
| T02–T17 | Not started | No product implementation or verification evidence yet |

## Next T00 work

1. Confirm OS edition/build and Defender state with an authorized host inventory; the current shell denied CIM and Defender status queries.
2. Complete read-only host and dependency probes that do not change system policy.
3. When a disposable Windows 11 setup and owned USB/HID devices become available, run policy, storage, HID, recovery, and isolation probes there.
4. Record actual results, fallback decisions, dependency licenses, and a working pinned toolchain before closing T00.

No USB enforcement experiment should run on the daily-use machine during discovery.
Software contracts, fixtures, and UI states may proceed while hardware evidence is pending. The USB Gate remains disabled and R1 cannot be declared complete until its physical acceptance matrix passes.

## T01 checkpoint

Rust 1.98.1 GNU toolchain and MinGW 16.2.0 were installed because the MSVC linker was absent. The first contract and CLI/UI tests were observed failing before implementation and then passing after implementation. The shared fixture is explicitly labeled as a preview. No service, scan, or USB enforcement exists yet.
