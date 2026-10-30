"""Mocked HID sequence checks; these tests send no real keys."""
import pathlib
import sys
import types
import unittest
from unittest.mock import patch

SOURCE = pathlib.Path(__file__).with_name('duck-code.py').read_text()


class PayloadTests(unittest.TestCase):
    def run_payload(self, reason, fail=False):
        events = []
        runtime = types.SimpleNamespace(run_reason=reason, autoreload=True)
        supervisor = types.SimpleNamespace(runtime=runtime, RunReason=types.SimpleNamespace(STARTUP='startup'))
        def write(text):
            events.append(('write', text))
            if fail:
                raise OSError('mock HID failure')
        keyboard = types.SimpleNamespace(press=lambda *keys: events.append(('press', keys)),release_all=lambda: events.append(('release',)))
        modules = {
            'supervisor': supervisor,
            'usb_hid': types.SimpleNamespace(devices=[]),
            'adafruit_hid': types.ModuleType('adafruit_hid'),
            'adafruit_hid.keyboard': types.SimpleNamespace(Keyboard=lambda _: keyboard),
            'adafruit_hid.keycode': types.SimpleNamespace(Keycode=types.SimpleNamespace(GUI='WIN',R='R',ENTER='ENTER')),
            'adafruit_hid.keyboard_layout_us': types.SimpleNamespace(KeyboardLayoutUS=lambda _: types.SimpleNamespace(write=write)),
        }
        with patch.dict(sys.modules,modules),patch('time.sleep',lambda duration:events.append(('wait',duration))):
            try:
                exec(compile(SOURCE,'duck-code.py','exec'),{})
            except OSError:
                if not fail:
                    raise
        return events,runtime

    def test_edit_reload_sends_no_keys(self):
        self.assertEqual(self.run_payload('reload')[0],[])

    def test_startup_opens_notepad_and_types_once(self):
        events,runtime=self.run_payload('startup')
        self.assertEqual(events,[('wait',2),('press',('WIN','R')),('release',),('wait',0.2),('write','notepad'),('press',('ENTER',)),('release',),('wait',0.5),('write','QUACK! Sentinel USB typing test reached this window. (o<)'),('release',)])
        self.assertFalse(runtime.autoreload)

    def test_failure_releases_all_keys(self):
        self.assertEqual(self.run_payload('startup',True)[0][-1],('release',))


if __name__=='__main__':
    unittest.main()
