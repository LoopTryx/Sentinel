# Unknown HID containment controller

Engineer B, issue12/15. Branch codex/engineer-b/issue-12-hid-containment,
base abb05cb. Independent Engineer A security review required before integration.

## Implemented

Broker-internal Rust controller in sentinel-usb, separate from the existing scan
worker. Begin requires the existing Gate to report a measured HID hold for this
exact connection. Storage scope does not change. Isolation provider must attach
exclusively and verify host exclusion before observation begins; failed attach
still goes through cleanup. Observations are connection/generation-bound.

One session,120-second observation budget,4096 reports,65536 bytes. Activity is
retained as counters/outcome only; no keycodes, command text, payload bytes, device
identifiers or raw file contents are logged or serialized. Limits are cumulative
and checked before addition, including integer overflow-sized inputs. No guessed
progress and no benign/malicious certification from activity counters.

Disconnect, hold loss, provider verification failure, clock rollback, cancellation,
timeout and budget overflow stop the session. Failed cleanup retains admission
ownership and its first terminal reason until explicit verified cleanup retry.
A quiet observation is only an observation; no API releases HID or approves it.
The existing platform must keep host input denied throughout and after cleanup.

## Executed checks

- All36 sentinel-usb tests pass:8 new synthetic-provider containment regressions
  and28 existing gate/policy/recovery/Windows fixture checks.
- Strict all-target USB clippy passes; Rust formatting applied.
- First test run7/8 passed: storage state expectation corrected from Observed to
  Gap because prior policy_lost intentionally marks both interfaces uncovered.
  Implementation was not weakened.
- Full unchanged tools/verify.ps1: pending at initial publication; final result
  must be recorded before calling the gate passed.

## Not implemented or verified

There is no native exclusive USB/VM provider in this change, no Windows HID filter,
no automatic device activation and no installed payload-blocking evidence.
The Isolation trait is a broker-internal contract, not authenticated IPC.
A provider must have bounded native attach/verify/stop operations and independently
enforced lifetime; the controller itself is synchronously driven, not a watchdog.
An independent recovery process and durable private journal Store are still open.
A normal process sandbox does not satisfy attach_exclusive. Do not implement that
operation by merely starting a VM, redirecting keyboard input, matching descriptors
or writing registry policy and returning success.

Microsoft describes Hyper-V Enhanced Session Mode as RDP-based peripheral sharing:
https://learn.microsoft.com/windows-server/virtualization/hyper-v/enhanced-session-mode
This documentation is not evidence that Sentinel can exclusively claim arbitrary
HID devices before Windows input delivery. A native provider must independently
prove that property, including composite interfaces and disconnect/re-enumeration.

Next boundary: coordinate exact native provider/bootstrap ownership with Engineer A;
implement durable recovery and supported pre-input enforcement, then exclusive
guest routing with host input demonstrably excluded. Do not auto-allow a quiet
device: delayed payloads and descriptor spoofing remain possible.

The owner has no spare recoverable Windows test machine. No machine policy or HID
blocking activation, payload execution, E: access or Defender changes were performed.
Actual interception/recovery acceptance needs a spare system, trusted keyboard,
recovery access and independent review. Unit tests do not replace those gates.