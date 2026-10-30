# AI glass polish — 20 October 2026

Owner approved circular request indicator, Think toggle beside Send, glass desktop notifications and cleaner WhatsApp cards. Installed console and extension 0.2.23, including Downloads/Sentinel-Extension and both known Desktop extension directories. Recoverable installation backup recorded in artifacts/password-companion-installed.json. No USB, vault or detection-policy changes.

Think is a provider selector: off routes submitted questions through ai.chat (local); on routes through existing native ai.send (configured NVIDIA). Toggling never sends a request. Missing configuration is explained; key storage/native provider boundary remains unchanged. Existing Enter/Shift+Enter behavior retained. Pending/queued work shows a circular CSS ring; it disappears on completion/error and has a reduced-motion fallback.

Notifications use a separate WPF presentation helper with acrylic where available, opaque fallback, keyboard-focusable Learn more/dismiss controls, 12-second lifetime paused while hovered/focused, and reduced animation where Windows disables client-area animation. Existing trusted finding callback retained. Offscreen WPF render and Learn more handler test passed; actual live acrylic compositing is not established by the offscreen preview.

WhatsApp and shared email AI cards use glass surfaces, quieter warning accents, safe text rendering and reduced-motion/forced-color fallbacks. Independent review found a light-theme warning contrast problem; corrected with an opaque dark warning label. Detection gating and message transport unchanged.

Evidence: full UI suite 97 tests/35 files passed; extension suite 166 passed before final CSS-only contrast correction; post-correction 12 focused message/WhatsApp tests passed. UI build, extension build/parity smoke, native compilation preserving installed scanner pins, notification layout/action test, native desktop window smoke and process-job smoke passed. Installed console hash matches build; running Sentinel observed. Prior full repository Rust verifier remains failed due cached-crate mismatch/linker memory exhaustion, not claimed green here.

Manual acceptance: reload 0.2.23 in Chrome and refresh messaging pages. Actual Chrome rendering and fresh NVIDIA paid/cloud requests were not operated by this task. Preview artifact: artifacts/ai-notification-preview.png. No publication/release artifact rebuild claimed.
