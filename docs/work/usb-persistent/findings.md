# Findings

Existing SNTINP03 is a USB Class03 deny plus explicit allow exceptions. UsbAdmissionJournal.Record hard-limits lease to300 seconds; worker owns apply/expiry/recovery tasks. Reusing this as a permanent single-device deny would restore the cross-device regression or defeat its durable recovery invariants. Current UI apply is centrally disabled after the owner incident; Allow is recovery-only with exact selected restart subjects.

Microsoft documents Prevent installation of devices matching device instance IDs, with retroactive application to installed devices. Candidate persistent backend should use exact DenyInstanceIDs entries, not DenyDeviceIDs USBClass03. Instance IDs can vary by port/identity and are not authenticated physical identity; do not promise universal malicious-HID prevention.

Current native policy root can contain a reviewed retired legacy marker and empty DenyInstanceIDs baseline. Capture/preserve authenticated baseline rather than deleting it. Existing saved/effective ownership/readback guards and crash-safe marker handling must be retained or adapted explicitly.

Do not replace installed manifest worker/compiler by accident: current operator resources/pins belong to qualified leased backend. Build persistent candidates in artifacts/usb-persistent-build; migration is a separate reviewed gate.
