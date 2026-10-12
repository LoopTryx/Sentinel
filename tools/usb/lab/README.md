# Controlled USB typing test — secondary Windows11 device only

The RP2040 test types one short duck/message into a manually opened Notepad.
It uses no hotkeys, commands, Enter key, network, downloads or account changes.
The official Hak5 ASCII payload library inspired the visible-output test; this
CircuitPython implementation is original and fits the mounted RP2040-Zero.

The existing Sentinel USB controller is not a native pre-input interception driver.
`test-guard.ps1` is a separate exact-device lab adapter. It disables an already
connected selected USB keyboard using Windows PnP, checks problem code22 and has
explicit restore. A successful test proves this controlled stop, not automatic
new-device containment, malicious-payload discovery or universal BadUSB prevention.

On the secondary machine, use a built-in keyboard/mouse as recovery input:
1. Keep `SENTINEL-LAB-ARM.txt` absent. Connect the prepared RP2040.
2. Run `test-guard.ps1 -Mode List`. Identify its exact HID keyboard in Device Manager;
   unplug/replug only the RP2040 to confirm identity. Never select the built-in keyboard.
3. As Administrator run `-Mode Hold -LabComputerName SECONDARY_NAME
   -DailyComputerName PRIMARY_NAME -InstanceId 'HID\VID_...\...'`.
4. Verify the tool reports disabled/code22. Open Notepad and focus its blank document.
5. Within three minutes of connection, create `SENTINEL-LAB-ARM.txt` on CIRCUITPY with
   exactly `SECONDARY-WINDOWS-NOTEPAD-TEST`. Return focus to Notepad within five seconds. No text should arrive.
   This marker requires careful focus; do not create it on the daily laptop.
6. Restore the exact device with `-Mode Restore` and the same arguments/receipt.
7. Remove only the test arm marker; unplug/replug. Repeat the typing test without
   Hold to confirm the payload works. Delete the marker before reconnecting anywhere.
8. Record both outcomes, device state and restoration. Never report success from
   absence of typing alone: verify the device disabled AND the control run types.

Keep the receipt until restore is verified. If automation fails, use Device Manager
to re-enable the selected lab device. Broad install restrictions/registry policy
and activation on the daily computer are excluded. No lab run has yet been observed.
