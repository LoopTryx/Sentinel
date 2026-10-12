# Board diagnosis and naming correction

The owner's connected RP2040-Zero runs CircuitPython 10.2.1. Serial observation
on its COM5 console found the prepared code running in the marker-wait loop,
not in safe mode (`SafeModeReason.NONE`). The diagnostic Ctrl-C produced its
own KeyboardInterrupt; that must not be reported as a pre-existing failure.
Real imports of usb_hid, adafruit_hid.keyboard and keyboard_layout_us succeeded,
and three HID report interfaces were available. No host keystrokes were sent by
these diagnostics. Yellow startup flashes alone do not diagnose a crash.

The previous interaction required manually creating an approval file, which
was absent. A Start-Typing-Test.cmd/PowerShell helper is now on verified
CIRCUITPY D:. After physical reconnect, the owner opens Notepad, explicitly
approves one text-only run, and has ten seconds to focus Notepad. The helper
verifies the prepared loader hash, excludes E:, writes UTF-8 without BOM and
removes its exact one-run marker afterward. The board also accepts a BOM marker
and returns normally when unarmed, rather than raising an exception for an
intentional idle stop. Prior loader was backed up; board files hash-verified.
Actual typed-text acceptance is still pending the owner's result.

Windows bus-reported descriptions are now optional `name` fields in the existing
USB inventory boundary: ASCII printable, 1–80 characters, rendered as plain text
and never used for authorization. The owner requested local display names;
instance IDs, serials and paths remain excluded. Generic descriptions are kept
unnamed. Optional description lookup cannot invalidate parent/container lookup.
Input/storage candidates are prioritized within the original bounded collector.
The UI shows reported names where available and consolidates nameless interfaces
into one count row. Name equality does not combine physical devices or prove
identity. Composite storage scanning and quarantine remain unactivated.

Evidence: Windows inventory regressions passed; 26 UI tests and production build
passed; five mocked payload checks passed, including BOM approval; helper syntax
passed. Full local verifier passed. Live inventory still had partial coverage;
only one reported group had a name in the sampled run, so complete identification
is not claimed. Native UI visual and typed-text hardware acceptance remain open.
