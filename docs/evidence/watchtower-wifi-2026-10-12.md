# Watchtower Wi-Fi replacement

Owner explicitly requested replacing message checking and synthetic alerts with
the planned Wi-Fi goal. The current screen is now a real manual passive assessment,
not continuous monitoring, enforcement or an evil-twin verdict.

Native `wifi.assess({})` maps to desktop-only authenticated POST `/wifi` with an
empty body. Browser credentials cannot call it. One collector at a time;8-second
child timeout and8KiB output limit. Fixed read-only PowerShell entry point; no
browser paths/commands, active probes, network switching or privacy-setting changes.
Report source/validation: apps/demo-runtime/wifi.mjs and wifi-observe.ps1.

Response version1 carries observedAt, coverage=passive, seven allowlisted
observation enums, derived checks and coverage limitations. Network names, BSSIDs,
IP/DNS addresses and raw command output are never returned or logged. Multiple
profiles/localized or denied output yields unavailable fields. Gateway/DNS checks
describe configuration, not reachability or interception. VPN adapter observation
does not prove traffic protection. Baselines, captive portals and evil-twin checks
remain explicit next work.

PASS: UI26 tests including collection failure/no invented alert; focused assessment
and allowlist checks; UI production build; native C# build. Actual read-only
collector and authenticated live runtime both returned wifi/WPA2/passive on this
machine. Managed launch kept visible console process31132/window329826 available.
No hardware/network mutation; no full milestone completion claimed.
