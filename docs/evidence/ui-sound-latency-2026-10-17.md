# UI sound onset — 17 October 2026

Owner reported delayed interface sounds. Existing code already preloads the clips
and starts button/navigation playback on pointerdown, without a playback timer.
FFmpeg decoded-waveform silence detection at -45 dB measured leading silence:

| Clip | Original MP3 | Trimmed PCM WAV |
| --- | ---: | ---: |
| Navigation | 1025.3 ms | 4.0 ms |
| Button | 139.3 ms | 4.0 ms |
| Notification | 98.2 ms | 4.0 ms |
| Open | 48.0 ms | 4.0 ms |
| Error | 27.1 ms | 3.9 ms |

`tools/trim-ui-sounds.ps1` reproduces the WAV copies from the untouched original
recordings. It trims only the outer edges at -45 dB, retaining 5 ms onset and
30 ms tail padding; it preserves gaps inside each sound. PCM avoids adding MP3
encoder padding back. `ui-sounds.ts` imports these WAV copies; volume, mute,
preload, trusted-input, overlap and alert-priority behavior are unchanged.

Verification: TypeScript/Vite production build passes. Existing two sound tests
pass (overlap/mute/priority and denied autoplay). Decoded-waveform onset was
measured on every generated WAV. These measurements do not measure Windows audio
device/output latency or establish subjective listening acceptance.
