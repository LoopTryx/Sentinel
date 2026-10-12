# USB and Watchtower handoff

This increment connects the desktop USB page to the existing bounded Windows PnP
inventory collector and fixes Wi-Fi classification using both authentication and
cipher. It does not activate Sentinel's HID containment controller.

## Desktop operation

`demoCall('usb.observe')` takes no parameters. The native console invokes the
authenticated desktop-only `POST /usb` with `{}`. Paired extension callers get
403; additional input fields get 400. No device mutation method is exposed.

Success uses the authoritative inventory schema consumed by
`apps/ui/src/features/usb/inventory.ts`, for example:

```json
{"schemaVersion":1,"mode":"observation_only","state":"observed","observedAt":"2026-10-13T00:00:00.000Z","omitted":0,"devices":[{"ref":"device-1","usbEvidence":"os_reported","interfaces":["storage","hid_keyboard"]}]}
```

References are ephemeral display labels, not action authorization. Raw instance
IDs, serials and device names remain in the collector process. The collector is
limited to 64 displayed groups, 32 KiB output and a ten-second process timeout.
Concurrent requests return 503 `usb_busy`; unsupported platforms return 503
`usb_unsupported`; process/parse failures return 503 `usb_unavailable`.
There is no progress stream or cancellation operation for this short snapshot.
Partial and unavailable snapshots retain their original states. The UI clears
the previous report before refreshing and on failure. This is an explicit
snapshot, not continuous monitoring, automatic blocking or attack history.

## Wi-Fi

An English Open/WEP combination now returns `wep`; Open/None returns `open`.
Missing, ambiguous or unsupported localized authentication/cipher output stays
unknown. Passive assessment does not detect evil twins or inspect traffic.

## Secondary-device lab

See `tools/usb/lab/README.md`. The original text-only CircuitPython test is staged
on verified CIRCUITPY D:, with no approval marker present. Its original loader
was backed up under local artifacts. E: was not accessed. Preparation and mocked
logic checks do not prove hardware typing or blocking.

The separate `test-guard.ps1` adapter requires a named secondary machine,
administrator privileges, one exact present keyboard, verified USB ancestry,
and a recovery receipt. It is pending independent security review and real
secondary-machine acceptance. Do not represent this adapter as automatic
Sentinel threat detection. Required evidence: problem code 22 while held,
no text during the armed run, successful text after restore/reconnect, and
verified restoration. No privileged device changes were performed here.

## Focused evidence

- UI: 28 tests passed; production build passed.
- Runtime route/privacy: three tests passed, including browser rejection for
  both Wi-Fi and USB and rejection of device-ID request fields.
- Wi-Fi parser: six classification checks passed.
- Payload: four mocked checks passed; no host keystrokes were sent by tests.
- Native console compiled; native demo smoke passed.
- Wrong-host lab mutation was refused before device access.
- Live read-only USB inventory: partial, 38 groups, three keyboard interfaces.

Full-verifier output is retained locally in
`artifacts/usb-wifi-verification.log`; report its final result separately.
Installed UI visual acceptance and secondary-device containment remain pending.
