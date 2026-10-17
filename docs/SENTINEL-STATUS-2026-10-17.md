# Sentinel — project and USB Guard brief

17 October 2026 · working branch for PR #74

## Project

Sentinel is a Windows security application with a desktop console and Chrome extension. Its areas include local file inspection, file quarantine/restore, password tools, Wi-Fi observations and USB Guard. The desktop uses a React interface in a native Windows host, with native C#/Rust components and a local runtime. Engineer B’s latest integrated UI is preserved. This brief does not certify every other module; today’s hardware work concerns USB Guard.

## What works and what does not

| Item | Current evidence |
|---|---|
| Connected external input-device list and per-device controls | Owner confirmed the console layout; built-in keyboard/trackpad are excluded. |
| Automatic opening at sign-in | Configured for the current user with a verified Startup shortcut; the next real sign-in launch is not yet observed. |
| Windows Hello authorization | Owner verified it; retained for device-access changes. |
| RP2040 Block | Owner confirmed QUACK worked after restarting Windows, then did not run after Block. One physical success; repeat/restart tests remain. |
| External keyboard Block | Failed: keyboard continued typing. |
| Optical mouse Block | Failed: interruption lasted about three seconds, then mouse worked. Its exact deny rule remained committed and matched Windows policy; Windows still reported the mouse started. |
| Mouse Allow | Owner confirmed the saved rule cleared. |
| RP2040 Allow and restart persistence | Not yet verified. |
| Interrupted-transaction recovery | Actual authenticated recovery passed after fixing empty-list validation; readback showed no pending transaction and no committed blocks at that checkpoint. |
| Builds and automated checks | Full repository verifier passed before the latest focused follow-ups. Native and synthetic tests are separate from physical acceptance. |

One shared backend handles exact Windows device-instance rules. There is no separate blocking implementation for each device. Extra scripts handle installation, diagnostics and recovery.

## What I understand you want next

1. External USB input devices start denied and remain denied until you choose **Allow** in USB Guard.
2. Built-in keyboard and trackpad remain usable. Existing external devices must not silently become trusted.
3. Approval requires Windows Hello. Block/Allow must affect only the selected device, survive restarts where intended, and report actual Windows status accurately.
4. Sentinel opens automatically when you sign in to Windows. Opening the app at sign-in is separate from enforcement before sign-in.

**Default-deny is requested, not delivered.** A working RP2040 test does not prove reliable keyboard/mouse blocking. Current policy readback can succeed while input continues. The next enforcement work must close that gap and verify release/recovery before enabling default-deny across devices. USB storage scanning is also separate from HID input blocking.
