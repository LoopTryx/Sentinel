# Email checks — stage 1: local extraction

14 October 2026, Engineer B. Owner branch `prattyush-changes-for-v3`, issue14 / draft PR75. User requested seeing each stage before the next one. This stage was shown in the local synthetic reader preview before starting scoring.

Implemented new isolated Gmail/Outlook provider adapters, shared bounded field reader and MutationObserver coordinator. Outputs sender display/address, subject/body, visible link text and parsed destination, available Reply-To/authentication headers and attachment names. Explicit `unavailable` fields, truncated-field list and `coverage: partial` prevent missing metadata becoming a clean result. Header-like content inside the email body cannot become sender/SPF/DKIM evidence. No attachment is opened; no message is moved, clicked or changed.

Selectors are candidate DOM adapters tested against representative **invented fixtures**, not a supported-live-layout claim. Gmail/Outlook tenants, languages and client updates can differ. Authentication results are read only from exposed structured header rows; no raw header API, contacts API or reply-history inference is invented. DOM-derived sender/authentication metadata is not cryptographic verification.

Bounds in `data/email-extraction-config.js`:8 messages per pass,8192 body characters,512 subject characters,64 links,20 attachment names,2048 visited text nodes per field,32 header rows and180ms debounce. Attribute and resolved URL lengths are capped. DOM query/computed-style calls are not a hard execution deadline. Stage2 must not label partial extraction verified safe.

Cache retains only bounded DOM references and transient SHA-256 fingerprints. Body/address snapshots are passed only to a future local consumer, never logged/stored/uploaded. Stop/disconnect/generation checks reject stale async fingerprint results, debounce timers are cleaned up, hidden documents pause, and own future banner mutations are ignored.

Validation:13 reader regressions PASS;12 existing WhatsApp classifier/DOM regressions PASS; complete extension96 tests PASS; build and smoke source parity PASS. Full unchanged root verifier started separately; its outcome remains to be recorded. Fixture browser checked Gmail and Outlook extraction, including unavailable Outlook headers. Screenshot D:/SENTINAL/email-stage1-preview.png. No real inbox opened or browser permission requested; installed app/extension untouched. Reader modules are packaged but not registered as content scripts or activated.

Preview: `http://127.0.0.1:8791/test/fixtures/email-extraction-preview.html` while local server is running. Source fixture is `apps/extension/test/fixtures/email-extraction-preview.html`.

Next: reuse existing normalization/signals, editable email scoring and sender context; technical header/link/attachment checks; small opt-in banners; public-source sanitized corpus and before/after tuning. Optional cloud excerpt/URL upload stays disabled under current privacy policy. No full email detection or field accuracy claim from this extraction stage. Engineer A independent review requested before integration.
