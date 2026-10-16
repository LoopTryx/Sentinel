# Sentinel extension test build

[Download sentinel-extension-v19.zip](sentinel-extension-v19.zip?raw=true) · [SHA-256](sentinel-extension-v19.zip.sha256)

Version **0.2.14**, source commit **85e1643**. Extract the ZIP, open `chrome://extensions` or `edge://extensions`, enable Developer mode, and load the extracted folder containing `manifest.json`. Open Sentinel Settings to opt into Gmail or Outlook; refresh the email tab after enabling it.

This is an **experimental email test build**, not a production release. It preserves the existing WhatsApp flow and extension/native connection identity. It does not update the desktop app. The full local verifier, 135 extension tests and 15 final focused checks passed; the package validates all 60 extension files and includes its source/hash receipt. Public evaluation still misses 31/50 phishing examples and flags 4/70 legitimate examples. Actual Gmail/Outlook acceptance and independent review remain outstanding. Start with invented emails in a test account. No warning is not proof of safety.

No GitHub release was created. See [implementation/evaluation evidence](../docs/evidence/email-detector-draft.md).

The v10 UI frames flagged emails and places navy warning text below the message with blue/red mascots in opposite corners. Original v9 files remain available.

The v11 footer uses a stronger red radial gradient with a lighter central ring, 16px edge spacing and a 3px email outline. Full local verifier and focused UI regressions pass; 375px preview inspected.

Owner follow-up: v12 uses the exact URL warning-page layered radial background; spacing, navy text, mascots and thicker outline remain.

The v13 footer enlarges both mascots, brightens the radial centre, and uses borderless navy buttons with light-blue labels. Five focused UI regressions and build/smoke pass; default and 375px previews inspected. Detection behavior is unchanged.

The v14 build bundles Cabinet Grotesk for the warning heading, shadcn-inspired native buttons, clearer/shorter warning copy, a slightly darker centre, and soft mascot shadows. Font and license are local package resources.118 extension tests, full verifier and build/smoke pass. Browser preview access was blocked by URL policy, so actual visual/font-loading acceptance is pending.

The v15 build darkens the email centre, draws a 5px frame inside the message edge, and adds a navy popup with supplied peeking/hanging mascots. Text is larger across the extension. Desktop source also gains Cabinet/Inter typography and real scan findings driving an above-content red alert; this ZIP does not update the desktop executable. Final119 extension tests,40 UI tests/build and full local gate pass. Browser/installed visual acceptance remains pending.

The v16 build opens Settings first, aligns both mascot ledges to the panel borders, hides the visual scrollbar while keeping content keyboard/wheel scrollable, and makes the lower CSS canvas transparent. Email warnings are centred across the avatar gutter, spaced inside the frame and shortened. The native Chrome popup remains the containing window; actual see-through transparency is unverified.121 extension tests,40 UI tests/build and the final full verifier pass. The source desktop scanner was restored/staged locally and its file/folder session checks pass; this extension ZIP does not install that desktop worker.

The v17 build enlarges the navy popup and replaces the black alpha fallback with an opaque beige contrast canvas. Rounded borders, aligned mascot ledges and bolder type improve readability. Report wrong flag requires a real local-save acknowledgement; Trusted senders opens a full-size tab with the actual form expanded/focused. Save/remove, failure/retry and fixed destination tests pass.124 extension tests,41 UI tests/build and full local verifier pass. Desktop source adds blue/navy selection and functional quick actions/cards with reduced-motion-aware feedback. No desktop installation update or native transparency promise; installed visual acceptance and peer review remain pending.

The v18 toolbar opens a transparent floating navigation panel on ordinary HTTP(S) pages, with the page visible around the navy card and hanging mascot. Allow optional scripting when asked. Refresh a webpage after loading the extension, then click Sentinel. Settings and Passwords open secure extension tabs; restricted pages fall back to secure Settings. Only two public mascot images are exposed to webpages. No page text or credentials are read by the panel. Actual installed Chrome appearance still needs manual acceptance; source/DOM checks do not establish browser compositing behavior.

The v19 build restores the native toolbar popup. Red and blue mascots overlap the inner navy card; Chrome still owns a rectangular outer popup. Trust this sender now saves the current observed email sender directly, with same-tab/document bounds, provider opt-in, expiry, user-click and storage acknowledgement checks. Strong-risk warnings remain, and sender removal is available in Settings. Installed Chrome/Gmail/Outlook acceptance and independent review remain pending.
