# USB watchdog recovery — 14 October 2026

The native recovery test now covers abrupt process death and a simulated hung lease holder. Both use a uniquely named disposable HKCU namespace and synthetic device strings. Windows DeviceInstall policy and live devices are untouched.

Run from the repository root with native registry access:

```powershell
& tools/test-usb-restrictive-watchdog.ps1 -Hang
& tools/test-usb-restrictive-watchdog.ps1
& tools/test-usb-recovery-process.ps1
```

All three passed on 14 October. The first two independently read back the restrictive baseline and confirm the approval journal is cleared before explicitly undoing the original scratch baseline. The legacy first-install test restores its originally empty scratch state.

For the hung-process case, the test guardian launches only its own fixed executable, puts that child in a private kill-on-close job before authorizing scratch application, waits beyond the two-second lease, terminates the still-running owned child, and executes native recovery. Handshakes have five-second bounds. Background processes are hidden. This is an isolated guardian test, not an installed SYSTEM watchdog or qualification of pre-input containment.

The owner reports that the laptop keyboard works in Windows Recovery, the trackpad does not, and Windows was resumed successfully. This does not verify Safe Mode or an offline policy restore.

Remaining: protected installed recovery supervision, authenticated service/enrollment and apply, then firmware-backed policy trials establishing whether unknown-device input is stopped before delivery. No live input restriction was activated by this increment.

One repeat during the concurrent full verifier failed the guardian exit check after its recovered marker; failure cleanup ran, and a direct crash-scenario rerun passed. The cause is unresolved. Treat guardian exit reliability as pending investigation rather than production-ready; the bounded test failure remains visible.

Independent static review found and resolved an uncontained crash-test child. Both scenarios now assign the owned child to a kill-on-close job before apply. Failure cleanup also restores the separate baseline journal when the primary journal was never created.
