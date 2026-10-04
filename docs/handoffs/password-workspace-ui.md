# Password workspace and companion presentation — owner request, 4 October 2026

The owner explicitly asked Codex to improve both desktop and extension presentation. This bounded issue11 increment overrides the normal logic-only assignment for these files; GLM's active branch is untouched. Stack dependency: PR43/40 local companion tools, with recovered main Y2K React shell. Do not merge this stack until coordinator/peer review.

## What changed

Passwords now has its own navigation and three sections: Accounts, Password health, Generator & checker. Quarantine is named separately, including the console count. The account workspace has a searchable sample list, selected details, illustrative weak/reuse labels and guidance. Existing educational local tools remain available without a sample vault. Closing the sample or leaving its route discards selection/search; changing search invalidates details. No account password values are present. Real unlock/import/fill remain disabled and unavailable, not a simulated protected vault. Reserved example.test metadata is invented.

The companion retains URL and message checks but splits them into Link X-Ray, Passwords and Scam clues. Connection/test diagnostics are a disclosure below the primary task. Desktop-vault access is unavailable. Local cryptographic generator uses rejection sampling, 12–48 characters and bounded provider failure. Generated output is masked by default, explicitly copied only on user action, and cleared on section/length changes, Clear, Clear local inputs and pagehide. Clipboard failure is explained; async copy feedback cannot reappear after clearing. Clipboard contents are not automatically erased. No storage/network/cloud/autofill/site changes were added; manifest permissions unchanged.

## Integration and checks

Desktop entry: PasswordManagerView imported by App password route. Current account data is metadata-only local sample data, never an authoritative audit result. GLM should replace the unavailable state only when reviewed shared-vault capability/session/error DTOs and explicit origin-bound operations exist. No password persistence, master-password entry or fake unlock in this view. The browser card must reflect that same reviewed service, not invent an independent vault. Native host transport remains pending.

Full tools/verify.ps1 passed after fixing a dashboard status union type error. UI8 tests, extension40 tests, syntax/build/parity and Rust workspace checks passed. New tests exercise disabled real vault actions, close/reset, attention filtering, stale-detail invalidation, real crypto bounds, rejection sampling and failing random source. Smoke parity includes new generator module; verifier includes its tests.

Browser review of actual rendered local source: account selection, sample layout, companion section changes, masked generation and generated-output clear on returning to Passwords. 390x720 companion viewport had 375px usable width (scrollbar), 375px document scrollWidth after correcting max-width from100vw to100%. Desktop DOM1280px: shell1280, main1062, workspace993 ending1241, no horizontal content overflow. Localhost extension preview shows unavailable Chrome/native capabilities; this is NOT a new installed-Chrome verification. Saved screenshots in the owner's visualization folder. Existing native console consumes this same Vite source via HMR; updated native screenshot/manual interaction has not been claimed.

## Remaining acceptance

Independent GLM/coordinator presentation review and integration, rebuild/reload the installed extension from reviewed source, keyboard/narrow native journey, actual shared vault/import/audit/fill, native browser connection/events/download scans, WhatsApp inline warnings and consented provider explanations. No whole issue/S1 completion claim. Keep the original rightmost Trello schedule unchanged.
