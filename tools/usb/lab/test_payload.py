"""Host-side logic checks; never imports real USB libraries or sends keys."""
import io
import pathlib
import sys
import types
import unittest
from unittest.mock import patch

SOURCE = pathlib.Path(__file__).with_name('duck-code.py').read_text()


class PayloadTests(unittest.TestCase):
    def run_payload(self, reason, marker=None):
        sent = []
        released = []
        runtime = types.SimpleNamespace(run_reason=reason, autoreload=True)
        supervisor = types.SimpleNamespace(runtime=runtime, RunReason=types.SimpleNamespace(STARTUP='startup'))
        keyboard = types.SimpleNamespace(release_all=lambda: released.append(True))
        modules = {
            'supervisor': supervisor,
            'usb_hid': types.SimpleNamespace(devices=[]),
            'adafruit_hid': types.ModuleType('adafruit_hid'),
            'adafruit_hid.keyboard': types.SimpleNamespace(Keyboard=lambda _: keyboard),
            'adafruit_hid.keyboard_layout_us': types.SimpleNamespace(KeyboardLayoutUS=lambda _: types.SimpleNamespace(write=sent.append)),
        }
        def open_marker(*_):
            if marker is None:
                raise OSError('not armed')
            return io.StringIO(marker)
        with patch.dict(sys.modules, modules), patch('builtins.open', open_marker), patch('time.sleep'):
            try:
                exec(compile(SOURCE, 'duck-code.py', 'exec'), {})
            except SystemExit:
                pass
        return sent, released, runtime

    def test_edit_reload_never_types_even_with_marker(self):
        self.assertEqual(self.run_payload('reload', 'SECONDARY-WINDOWS-NOTEPAD-TEST')[0], [])

    def test_missing_marker_never_types(self):
        self.assertEqual(self.run_payload('startup')[0], [])

    def test_wrong_marker_never_types(self):
        self.assertEqual(self.run_payload('startup', 'wrong')[0], [])

    def test_approved_startup_types_once_and_releases_keys(self):
        sent, released, runtime = self.run_payload('startup', 'SECONDARY-WINDOWS-NOTEPAD-TEST')
        self.assertEqual(sent, ['QUACK! Sentinel USB typing test reached this window. (o<)'])
        self.assertEqual(released, [True])
        self.assertFalse(runtime.autoreload)


if __name__ == '__main__':
    unittest.main()
