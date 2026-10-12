"""One explicitly armed text-only typing test; no shell or network actions."""
import time
import supervisor


def run():
    if supervisor.runtime.run_reason != supervisor.RunReason.STARTUP:
        print("Test idle. Reconnect before starting a typing test.")
        return
    supervisor.runtime.autoreload = False
    print("Test ready. Run Start-Typing-Test from CIRCUITPY within three minutes.")
    armed = False
    for _ in range(1800):
        try:
            with open("/SENTINEL-LAB-ARM.txt", "r") as marker:
                armed = marker.read(64).strip("\ufeff \t\r\n") == "SECONDARY-WINDOWS-NOTEPAD-TEST"
        except OSError:
            pass
        if armed:
            break
        time.sleep(0.1)
    if not armed:
        print("Test finished without approval. No keys sent.")
        return
    import usb_hid
    from adafruit_hid.keyboard import Keyboard
    from adafruit_hid.keyboard_layout_us import KeyboardLayoutUS
    keyboard = Keyboard(usb_hid.devices)
    layout = KeyboardLayoutUS(keyboard)
    print("Approved. Focus blank Notepad now. Typing in ten seconds.")
    time.sleep(10)
    try:
        layout.write("QUACK! Sentinel USB typing test reached this window. (o<)")
    finally:
        keyboard.release_all()
    print("Typing test complete.")


run()
