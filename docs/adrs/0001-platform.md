# ADR 0001: Initial platform target and evidence gate

Status: provisional, 2026-09-29. Source: v3 master plan sections 1–5, 8/T00, 10, and 16.

Sentinel targets Windows 11 x64 Home/Pro for personal use, with Microsoft Defender active. The architecture uses a small privileged broker, per-user agent and vault, restricted workers, desktop UI, and browser extension. The initial release has no kernel driver. Windows 10 is optional legacy compatibility, not a release promise.

The USB storage hold and new HID approval gate are R1 requirements only on a **declared, physically tested** configuration. Each device path must be labeled proven pre-access hold, measured post-mount containment, or unsupported. Descriptor labels do not authenticate a device. R1 cannot be declared complete until the hardware matrix and recovery gate pass.

No policy mutation will be attempted on the owner's daily-use machine during T00 discovery. Every later OS mutation needs preview, authorization, journal, and tested rollback. Defender remains enabled.

## Observed host facts

On 2026-09-29, read-only registry queries returned `EditionID=Professional`, `DisplayVersion=25H2`, `CurrentBuild=26200`, `UBR=9457`, and a legacy `ProductName=Windows 10 Pro` string. The edition/build require confirmation using an authorized OS inventory. The shell ran at medium integrity; it could not read CIM operating-system/processor records or `Get-MpComputerStatus`. Node, pnpm, and Git were found; Rust/Cargo were not found on PATH. Hardware capacity, Defender state, admin elevation, and lab equipment remain unverified.

## Decision gate

Do not choose an enforcement API or promise a USB gate until physical device tests show policy precedence, parent/child behavior for composites, existing-device exceptions, exposure window, restart/uninstall recovery, and Home/Pro differences. An unsupported result keeps that capability disabled and visible.
