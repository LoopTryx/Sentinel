# Physical USB grouping, owner approval and recovery evidence

13 October 2026, Engineer A, owned desktop-v2 branch; continues the approved quarantine plan. No machine enforcement activated.

## Implemented and tested

Desktop usb.observe now calls bounded native SetupDi/CM enumeration (keyboard, mouse, HID and disk setup classes), grouping normal-present functions by their supported physical USB ancestor. Platform and Bluetooth/non-USB inputs are excluded from USB display. Missing roots remain unresolved instead of being merged by container claim. No mounted-volume reads. Names are Windows-reported descriptions, not enrollment or firmware authenticity. Primary cards show keyboard/mouse/storage groups; auxiliary and unresolved interfaces remain under details. The script collector also no longer uses container-only grouping.

Ducky-free live native inventory completed with no omissions: three physical USB groups, 2.4G Receiver / ITE Device(8258) / USB Optical Mouse. Owner says receiver is probably their keyboard; it is not enrolled. Receiver unplug/reconnect identification is pending. The Ducky's previous row was automatic observation, never a manually trusted profile.

Native window-owned Windows Hello uses IUserConsentVerifierInterop.RequestVerificationForWindowAsync with a same-process foreground HWND check. It collects only verification outcome. A running/unknown operation retains the busy latch if task projection fails; timeout requests cancellation and does not admit another prompt until completion. Native subject/action approval binds the current connection object/generation and capabilities, refuses disconnect/reconnect, wrong subject/action, denied verification, clock rollback and prompt overlap. Permits expire after five seconds and are single-use. It is not exposed as an IPC authentication Boolean or a UI enrollment operation.

Production-adapter live test: tools/test-usb-owner-verification.ps1 -Live returned ownerVerified=True and replayRefused=True, for a synthetic test connection. No real USB was approved or blocked. Headless failure-path tests and tools/test-usb-approval-binding.ps1 PASS.

Actual process recovery: tools/test-usb-recovery-process.ps1 compiles the authoritative Rust WindowsRegistry, PolicyBackend, JournalStore and Recovery code into a test-only helper. The sole selectable registry target is a nonce-scoped HKCU scratch namespace; the machine() constructor is never dispatched. An owned broker writes a two-second synthetic lease/delta, a separate watchdog is ready, the broker is killed, and the watchdog restores the native registry state and clears the journal. Native readback verifies empty state, then the exact owned scratch key is removed. Failure cleanup attempts bounded recovery and records retained inert-state coordinates. PASS. This is real process/registry/journal evidence, not installed machine-policy supervision or HID containment evidence.

Native/grouping/input monitor regressions PASS; four focused rendered UI USB tests PASS; UI production build and native desktop build PASS; full tools/verify.ps1 PASS in artifacts/usb-owner-and-physical-group-verify.log. Independent security review found one running-prompt cleanup failure; fixed and verified. Existing unrelated NativeConsole.cs is preserved untracked.

## Machine activation remains blocked

Read-only machine-policy inspection finds no existing DeviceInstall/Restrictions namespace; no mutation occurred. Bounded native baseline counts: 27 input setup nodes, including six platform-input nodes, zero unresolved/omitted. These are setup nodes, not 27 physical devices. Current InputPolicy accepts at most eight exact instance exceptions. Enabling its retroactive HID/keyboard/mouse class deny profile here would not preserve this baseline. Do not substitute current attachment for authenticated enrollment.

Needed: reviewed profile capacity/encoding change (proposed at most32 approvals with total encoded record bounded by the existing4072-byte recovery payload), agreed editing owner for shared policy.rs and tests; verified owner baseline and built-in exclusions; protected native broker/journal provisioning and independent startup recovery/watchdog; actual pre-input denial and everyday-input/recovery acceptance. A private HKCU test watchdog is not that installed supervisor. Public release/hold functions stay unavailable until these are wired and independently reviewed. No E: file access, Defender changes, privileged policy changes or live malicious execution.

## Contracts and next actions

usb.observe({}) remains the existing exact report-only schema consumed by inventory.ts. Desktop origin remains exactly https://sentinel.example/index.html?desktop=glass; other callers and nonempty requests are rejected. usb.activity remains generated canonical DTOs. No raw instance/parent IDs, handles, PINs or typed content appear in UI reports. Private candidate-count diagnostics have no UI/action authority.

Next: finish receiver comparison, agree shared policy edit ownership/review and bounded profile, then wire native owner verification into a protected broker with independently provisioned recovery before activating any device policy. A clean storage scan never authorizes HID.

Primary API reference: https://learn.microsoft.com/en-us/windows/win32/api/userconsentverifierinterop/nf-userconsentverifierinterop-iuserconsentverifierinterop-requestverificationforwindowasync
