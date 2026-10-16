# USB Guard display update and enforcement gate — 13 October 2026

Owner requested visible HID information and actual input quarantine. This increment updates the existing owned desktop branch; no shared policy/containment source or peer branch is edited.

Delivered: individual Windows-reported input/storage groups, including unnamed and unresolved HIDs; keyboard/mouse/other HID/storage tags; per-group input access, storage-inspection and enrollment status; update time and incomplete inventory. Unknown ancestry stays visible. Group references are snapshot labels, not stable device authority. Input quarantine remains unavailable, approval not enabled, storage scan not running. No demo language or long disclaimer in the primary layout; technical provenance is collapsed.

Inventory refresh uses a connection epoch and monotonically increasing request sequence. A late response cannot repopulate a disconnected view or replace newer inventory. Refresh runs every five seconds; observation is not before-first-input interception.

Verification: new rendered regression failed against the previous layout. Independent review reproduced an overlapping refresh race; reversed response completion test failed with Outdated replacing Newest, then passed after the sequence fix. Four focused rendered USB tests PASS; full repository tools/verify.ps1 PASS after final change (artifacts/usb-guard-layout-verify.log); production UI and native console build PASS. Independent static recheck reports no remaining blockers. Ordinary UI test discovery reports 38 tests; focused TSX tests were run explicitly, not inferred from that count.

Installed package: artifacts/Sentinel-Demo-20261013-185304. Live revision 0, four accounts, no running scan checked before replacing the installed candidate. First install attempt refused a still-locked directory and preserved the old app; retry succeeded after process exit. Installed index hash matches package; launch requested. Installed visual/hardware acceptance is not claimed.

Windows Hello availability is Available and owner-interactive standalone verification returned Verified. Installed subject-bound approval remains unimplemented; a standalone success cannot authorize a later device action.

Actual input quarantine is NOT enabled. Existing Windows policy provider is dormant. Prerequisites: native authenticated single-use action bound to current device/connection and owner verification; reviewed stable baseline/internal-device exclusions; privileged broker with private durable journal and independent recovery/watchdog; supported provider configured before attachment; actual zero-input-before-approval and recovery proof. Broad class restrictions can affect everyday inputs; post-arrival disable is not a first-keystroke hold. Storage quarantine additionally requires verified volume identity and restricted scanner integration. No device/registry policy mutation, storage access or payload execution was performed. Defender unchanged; E: untouched.

Microsoft reference: https://learn.microsoft.com/en-us/windows/client-management/client-tools/manage-device-installation-with-group-policy — installation restrictions have an explicit option for matching already-installed devices. This describes OS policy behavior, not acceptance evidence for Sentinel's adapter.
