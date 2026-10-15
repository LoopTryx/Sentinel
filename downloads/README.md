# Sentinel extension test build

[Download sentinel-extension-v10.zip](sentinel-extension-v10.zip?raw=true) · [SHA-256](sentinel-extension-v10.zip.sha256)

Version **0.2.5**, source commit **1399553**. Extract the ZIP, open `chrome://extensions` or `edge://extensions`, enable Developer mode, and load the extracted folder containing `manifest.json`. Open Sentinel Settings to opt into Gmail or Outlook; refresh the email tab after enabling it.

This is an **experimental email test build**, not a production release. It preserves the existing WhatsApp flow and extension/native connection identity. It does not update the desktop app. All 117 extension tests and the full local verifier passed; the package validates all 53 extension files and includes its source/hash receipt. Public evaluation still misses 31/50 phishing examples and flags 4/70 legitimate examples. Actual Gmail/Outlook acceptance and independent review remain outstanding. Start with invented emails in a test account. No warning is not proof of safety.

No GitHub release was created. See [implementation/evaluation evidence](../docs/evidence/email-detector-draft.md).

The v10 UI frames flagged emails and places navy warning text below the message with blue/red mascots in opposite corners. Original v9 files remain available.
