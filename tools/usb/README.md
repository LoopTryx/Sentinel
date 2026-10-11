# USB observation collector

Run from a trusted checkout with Windows PowerShell:

```powershell
powershell.exe -NoProfile -File tools/usb/read-inventory.ps1 > usb-inventory.json
powershell.exe -NoProfile -File tools/usb/tests/inventory.ps1
```

Import the JSON using USB Guard in the desktop UI. The report contains temporary references and fixed interface categories, without names, instance identifiers, serial numbers or paths. Import remains local and is cleared when the view unmounts. Reports expire after one minute; imported reports are untrusted observations, never authorization.

The collector queries present PnP metadata only. It does not enumerate volumes, read USB files, disable devices, change policies or request elevation. It does not inspect CRYPTIC (E:). Run it from an ordinary account. Missing ancestry, failed queries and truncated discovery produce partial or unavailable states. Container identifiers and interface descriptors are OS observations that a malicious device may spoof.

Limits: 512 retained nodes, 128 initial candidates, eight ancestry steps, 256 property queries, 64 output groups, 32 KiB output and a ten-second owned-worker deadline. The Windows PnP provider may internally enumerate additional records; this is not a claim of provider memory isolation. The wrapper terminates only its own worker on timeout. There is no continuous monitoring or pre-input enforcement.

Folder scanning awaits Engineer A's reviewed selection/job adapter. HID blocking requires an independently reviewed Windows authority and a recoverable lab with spare input. Storage permission must never grant HID permission. Do not enable or test blocking on the daily-use machine. Defender must remain enabled.
