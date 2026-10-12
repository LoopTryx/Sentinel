"""Controlled typing test for the owner's secondary Windows laptop."""
import time
import supervisor

# Editing the drive must never launch a payload on the machine preparing it.
if supervisor.runtime.run_reason != supervisor.RunReason.STARTUP:
    raise SystemExit("Reconnect on the secondary test laptop to arm.")

# Writing the approval marker must not restart this physical-startup run.
supervisor.runtime.autoreload = False

# No automatic typing on connection. The lab operator creates this marker only
# after focusing Notepad on the secondary device. One run per physical connection.
armed = False
for _ in range(1800):
    try:
        with open("/SENTINEL-LAB-ARM.txt", "r") as marker:
            armed = marker.read(64).strip() == "SECONDARY-WINDOWS-NOTEPAD-TEST"
    except OSError:
        pass
    if armed:
        break
    time.sleep(0.1)
if not armed:
    raise SystemExit("No lab approval. No keys sent.")

import usb_hid
from adafruit_hid.keyboard import Keyboard
from adafruit_hid.keyboard_layout_us import KeyboardLayoutUS

keyboard = Keyboard(usb_hid.devices)
layout = KeyboardLayoutUS(keyboard)
time.sleep(5)  # Allow the operator to return focus to the blank Notepad document.
try:
    # Text only: no hotkeys, Enter key, shell commands, remote code or downloads.
    layout.write("QUACK! Sentinel USB typing test reached this window. (o<)")
finally:
    keyboard.release_all()
