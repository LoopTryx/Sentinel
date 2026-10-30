# Durable USB rollback journal

Engineer B, issues12/15. Native policy activation remains disabled.

## Implemented

JournalStore implements the existing recovery Store using an owned native File.
It takes an exclusive OS file lock, refuses occupied leases, bounds records to
4096 bytes and total file size to4140 bytes, validates version/length/SHA-256,
flushes with sync_all and reads the persisted bytes back before success.
Recovery::arm_apply therefore cannot reach the policy mutation when persistence
fails. Clear validates the journal and synchronizes truncation; existing Recovery
calls it only after owned policy restoration and verification succeed.

No pathname API, raw device identifier logging, Debug or serialization is added.
sha2 was already in the workspace lock; the lock diff adds only the USB dependency.

## Native integration prerequisites

from_trusted_file is an internal boundary. The native broker must establish
private ACLs, retained no-follow ancestry, correct ownership and absence of
untrusted writers/handle aliases before passing a writable handle. This module
does not make an arbitrary user-selected file secure. The checksum detects
corruption; it does not authenticate writes by an administrator or other writer.

The exclusive lock is held until the store drops. A recovery supervisor must
verify the former owner has exited before taking over; it must not bypass the
lock of a hung owner. Configure bounded owner supervision and trusted recovery
startup separately. No watchdog/service registration or native broker IPC is
implemented here. Persisting a journal is not evidence of HID interception.

On startup, malformed/truncated records refuse rather than pretending there is
no pending policy. Recovery of corruption requires a separately reviewed recovery
procedure; this journal does not erase unexplained bytes. Flush/reopen tests are
not physical power-loss, faulty-storage or installed machine recovery acceptance.

## Validation

Eight regressions use disposable real files: write/flush/reopen/clear; exclusive
second-opener refusal and release; no overwrite; input/output bounds; bad magic,
length, checksum, payload, truncation and trailing data; oversized files; real
journal plus recovery protocol restart/failing restoration; unwritable handles
cannot reach policy mutation (or refuse at lock acquisition).
Strict all-target USB clippy passes. Complete unchanged tools/verify.ps1 PASS,
exit0:36 USB tests (8 journal plus28 baseline), workspace Rust checks, generated
binding parity,26 UI tests/build and extension/runtime/smoke checks. Log:
D:/SENTINAL/usb-journal-verify.log. PR66 containment remains a separate branch.

No HKLM/device policy activation, payload execution, E: access or Defender changes.
No pre-input protection claim. Independent Engineer A review and a spare recoverable
Windows test system are still required before enforcement acceptance.