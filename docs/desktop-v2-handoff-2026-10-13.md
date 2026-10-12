# Desktop app and automatic connection candidate

The owner requested a double-click app, fixed rectangular window, system tray
lifecycle and automatic extension connection. This candidate packages the
existing functionality without claiming completion of the broader V2 roadmap.

`Sentinel.exe` launches the WPF/WebView2 console and its bundled Node runtime.
The window uses NoResize, has no maximize control, fits within the work area,
and hides from the taskbar when minimized or closed. Its tray menu supports
Open and Quit. A second launch signals the existing instance. Quit shuts down
the owned runtime and clears its connection file. No login-startup entry or
privileged service is installed.

`Setup.exe` invokes the bounded per-user installer. Installation is under
LocalAppData/Sentinel/Desktop, creates a desktop shortcut and registers
HKCU Chrome NativeMessagingHosts/com.looptryx.sentinel for one detected
Sentinel extension ID. Unpacked extensions are identified by their manifest
name; ambiguous IDs require explicit selection. The app requires Windows,
.NET Framework and WebView2 Runtime. This is an unsigned local candidate.

The native bridge accepts only its registered Chrome extension origin and a
single `operation: connect` request, with a 1024-byte input limit. It reads
the local runtime connection file, validates loopback/token fields and calls
desktop `/pair`. Only browser credentials are returned. It exposes no shell,
file selection, quarantine, USB policy, raw observations or privileged action.
It can start the app in the tray if the app is stopped. The extension stores
credentials in browser session storage and retries only read-only `state`
after disconnect or stale authorization. Mutating calls are not replayed.

Chrome's new nativeMessaging permission and loopback host permission require
one reload/approval of the updated extension. Manual connection remains a
fallback. Installed Chrome popup acceptance has not been observed; native
framing and authenticated runtime pairing were tested with the actual compiled
and installed host.

Evidence on this candidate:
- Full tools/verify.ps1 passed.
- All 65 extension tests passed.
- Actual compiled native-host origin/request/credential checks passed.
- Fixed-window native smoke passed.
- Tray lifecycle smoke reported hidden=True and reopened=True.
- Per-user installation, desktop shortcut and native-host registry binding verified.
- Installed Sentinel window title and Console navigation verified.
- Installed native bridge issued a browser session accepted by running runtime.
- Existing Chrome extension build files updated with a preserved local backup.

The independent native-host/security review and installed browser reload/user
acceptance remain pending. No main merge or completed V2 protection claim.
The USB typing-test failure remains unverified; absence of typing alone does
not prove containment. Daily-machine USB/HID blocking remains excluded.
