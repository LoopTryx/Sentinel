# Findings

Existing SNTINP03 is a USB Class03 deny plus explicit allow exceptions. UsbAdmissionJournal.Record hard-limits lease to300 seconds; worker owns apply/expiry/recovery tasks. Reusing this as a permanent single-device deny would restore the cross-device regression or defeat its durable recovery invariants. Current UI apply is centrally disabled after the owner incident; Allow is recovery-only with exact selected restart subjects.

Microsoft documents Prevent installation of devices matching device instance IDs, with retroactive application to installed devices. Candidate persistent backend should use exact DenyInstanceIDs entries, not DenyDeviceIDs USBClass03. Instance IDs can vary by port/identity and are not authenticated physical identity; do not promise universal malicious-HID prevention.

Current native policy root can contain a reviewed retired legacy marker and empty DenyInstanceIDs baseline. Capture/preserve authenticated baseline rather than deleting it. Existing saved/effective ownership/readback guards and crash-safe marker handling must be retained or adapted explicitly.

Do not replace installed manifest worker/compiler by accident: current operator resources/pins belong to qualified leased backend. Build persistent candidates in artifacts/usb-persistent-build; migration is a separate reviewed gate.


## 17 October — native mechanism comparison and SYSTEM qualification

Microsoft documents CM_DISABLE_PERSIST (Windows10+) as persisting a devnode disable across reboot; CM_Enable_DevNode flags must be0; CM_Get_DevNode_Status problem code is meaningful only with DN_HAS_PROBLEM. Documentation: https://learn.microsoft.com/en-us/windows/win32/api/cfgmgr32/nf-cfgmgr32-cm_disable_devnode and sibling enable/status pages.

Read-only current RP2040 devnode comparison: keyboard HID collection and USB HID function both DN_DISABLEABLE=false, problem0; storage/serial/audio and mouse/consumer collections disableable=true. Composite parent also false. Historical exact keyboard pnputil disable returned critical-device refusal. No new native-disable or enable was attempted, no force, parent or unrelated-function target selected. Retain exact-instance GPO as authoritative candidate because native PnP route has not demonstrated safe input disable/release/persistence on the supported keyboard function. Read-only flags are not an actual CM_DISABLE_PERSIST trial.

Actual private scheduler readback after failed qualification: pending Prepared, committed absent; task SYSTEM, idle, two triggers. Windows normalizes PT180S to PT3M and returns effective DACL O:BAG:SYD:(A;;FA;;;SY)(A;;FA;;;BA)(A;;FR;;;SY). Validator falsely rejected those equivalent forms. Regressions reproduced refusal and now accept exact180seconds and cumulative full SY/BA rights; unknown principals, inherited/callback ACEs and insufficient rights remain refused. WorkingDirectory is now explicitly set/validated. Independent review approved effective-ACL approach. Qualification recovery process now joins its kill-on-close job before any children.

Antivirus missing-library investigation: rerun cargo test --offline -p sentinel-av --no-run in SAME isolated output directory succeeded without source changes. Subsequent unchanged full tools/verify.ps1 passed (artifacts/usb-finish-pr74-verify.log). Original root cause remains unestablished; no cache deletion, gate weakening or unrelated source changes.
