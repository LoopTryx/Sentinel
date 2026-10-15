# RP2040 direct device controls and progress handoff — 15 October 2026

Run in Administrator PowerShell from the repository:

```powershell
& ./tools/usb/disable-rp2040.ps1
& ./tools/usb/enable-rp2040.ps1
```

Each asks for confirmation. Add `-WhatIf` for a non-mutating preview. These scripts select only the exact physical instance in the existing machine-local Sentinel Ducky enrollment, never a name match, class, controller or wildcard. No automatic elevation, reboot, policy edits, Defender exceptions or driver installation. They request a direct PnP device state change; this does not remove USB power or guarantee prevention before a device first types. Disable persists until Windows/device lifecycle changes or Enable. Enabling cannot override a separate installation-deny policy; errors and restart requirements remain visible. Live execution and QUACK/normal-control recovery have not been tested for these scripts.

Prior work preserved: saved local GPO private write/refresh/release passed; harmless native SYSTEM worker containment passed (15.7 seconds stopped,16.8 seconds both locks free). Existing installed application remains on its earlier policy path. Independent private-GPO recovery qualification is NOT ready to run: review found a producer/recovery ordering race and cleanup accepting an older recovery result. Fix outstanding-deadline budgeting, force fresh cleanup after producer quiescence, and freshly verify released state before running it. New worker sources/tests are retained for continuation, not enabled in the app.

Engineer B work preserved: fetched origin/main71e4245 and origin/prattyush-changes-for-v3 extension v13 e0557e3. No B branch/UI/release ZIP or unrelated NativeConsole.cs edited. This change is published on A's existing PR74 branch; coordinator review/integration remains required.
