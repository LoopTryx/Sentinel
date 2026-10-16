"""Open Notepad and type harmless text once per physical startup."""
import time
import supervisor


def run():
    if supervisor.runtime.run_reason != supervisor.RunReason.STARTUP:
        print("Test idle. Reconnect before starting a typing test.")
        return
    supervisor.runtime.autoreload = False
    print("Opening Notepad in two seconds.")
    time.sleep(2)
    import usb_hid
    from adafruit_hid.keyboard import Keyboard
    from adafruit_hid.keyboard_layout_us import KeyboardLayoutUS
    from adafruit_hid.keycode import Keycode
    keyboard = Keyboard(usb_hid.devices)
    layout = KeyboardLayoutUS(keyboard)
    try:
        keyboard.press(Keycode.GUI, Keycode.R)
        keyboard.release_all()
        time.sleep(0.2)
        layout.write("notepad")
        keyboard.press(Keycode.ENTER)
        keyboard.release_all()
        time.sleep(0.5)
        layout.write("QUACK! Sentinel USB typing test reached this window. (o<)")
    finally:
        keyboard.release_all()
    print("Typing test complete.")


run()
