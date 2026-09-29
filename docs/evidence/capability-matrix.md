# T00 capability matrix

Recorded 2026-09-29. `Observed` means a read-only fact was seen in this environment; it does **not** prove an enforcement capability. Product capability labels use proven, partial, unavailable, or untested. No physical hardware tests have run.

| Capability / environment | State | Evidence and next proof |
| --- | --- | --- |
| Local Git history | Observed | Repository was initialized with no commits and no remote before this stage |
| Windows edition/build | Partial | Registry returned Professional, 25H2, 26200.9457; legacy ProductName conflicts. Confirm authorized OS inventory |
| Defender active | Untested | `Get-MpComputerStatus` returned Access denied in medium-integrity shell |
| Rust/Cargo toolchain | Unavailable in current PATH | `Get-Command` found Node, pnpm, Git but not Rust/Cargo; install/pin after dependency review |
| Admin access, RAM, CPU | Untested | CIM calls denied; authorized host inventory pending |
| Disposable Windows 11 machine and owned USB/HID lab devices | Unavailable | Owner reported none available on 2026-09-29; physical gate testing deferred |
| USB enumeration and policy precedence | Untested | Physical Windows 11 Home/Pro device matrix required, including composite parent/child and previously installed paths |
| Removable storage pre-access hold | Untested | Need physical plug-in/read attempt, scan/release, exposure timing, crash/reboot/uninstall recovery |
| New HID pre-input approval | Untested | Need owned benign HID fixture and proof of no delivered input before approval; record no key content |
| Wi-Fi observation and location consent | Untested | Compare consent allowed/denied, offline, VPN and portal observations without active probes by default |
| Restricted worker isolation | Untested | Prove token, filesystem, network, handle, resource and escape boundaries in disposable environment |
| ClamAV process memory | Untested | Measure whole process tree with Defender enabled and actual engine/database versions |
| Native-host launch | Untested | Verify exact extension ID, caller validation, suspend/restart, and browser support |

No untested row can be promoted to proven by a fixture or an API documentation claim alone. Store each later probe's OS/build, device, command, actual result, timing, recovery result, and limitation alongside this matrix.

## Fallback decision

Continue read-only host probes and software-only contracts, fixtures, and capability reporting. Do not apply experimental device-installation restrictions to the daily-use machine. Storage pre-access hold and HID pre-input approval stay disabled and unclaimed until an owned physical test setup can prove them. If such a setup remains unavailable, an R1 release claiming the USB Gate is a no-go under the v3 master plan.
