# Sentinel extension test build

[Download sentinel-extension-v15.zip](sentinel-extension-v15.zip?raw=true) · [SHA-256](sentinel-extension-v15.zip.sha256)

Version **0.2.10**, source commit **87af170**. Extract the ZIP, open `chrome://extensions` or `edge://extensions`, enable Developer mode, and load the extracted folder containing `manifest.json`. Open Sentinel Settings to opt into Gmail or Outlook; refresh the email tab after enabling it.

This is an **experimental email test build**, not a production release. It preserves the existing WhatsApp flow and extension/native connection identity. It does not update the desktop app. All 119 extension tests and the full local verifier passed; the package validates all 58 extension files and includes its source/hash receipt. Public evaluation still misses 31/50 phishing examples and flags 4/70 legitimate examples. Actual Gmail/Outlook acceptance and independent review remain outstanding. Start with invented emails in a test account. No warning is not proof of safety.

No GitHub release was created. See [implementation/evaluation evidence](../docs/evidence/email-detector-draft.md).

The v10 UI frames flagged emails and places navy warning text below the message with blue/red mascots in opposite corners. Original v9 files remain available.

The v11 footer uses a stronger red radial gradient with a lighter central ring, 16px edge spacing and a 3px email outline. Full local verifier and focused UI regressions pass; 375px preview inspected.

Owner follow-up: v12 uses the exact URL warning-page layered radial background; spacing, navy text, mascots and thicker outline remain.

The v13 footer enlarges both mascots, brightens the radial centre, and uses borderless navy buttons with light-blue labels. Five focused UI regressions and build/smoke pass; default and 375px previews inspected. Detection behavior is unchanged.

The v14 build bundles Cabinet Grotesk for the warning heading, shadcn-inspired native buttons, clearer/shorter warning copy, a slightly darker centre, and soft mascot shadows. Font and license are local package resources.118 extension tests, full verifier and build/smoke pass. Browser preview access was blocked by URL policy, so actual visual/font-loading acceptance is pending.

The v15 build darkens the email centre, draws a 5px frame inside the message edge, and adds a navy popup with supplied peeking/hanging mascots. Text is larger across the extension. Desktop source also gains Cabinet/Inter typography and real scan findings driving an above-content red alert; this ZIP does not update the desktop executable. Final119 extension tests,40 UI tests/build and full local gate pass. Browser/installed visual acceptance remains pending.
