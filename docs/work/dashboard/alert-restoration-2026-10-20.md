# Alert restoration — extension 0.2.28

Owner approved direct opening, restored red warnings, notification glass and persistent duplicate suppression.

- Message Learn more authenticates the source, rechecks opt-in and scoped reference, queues ai-open, then invokes the existing native open-ai connector. No intermediate tab. Link warning uses the existing authenticated demo transport directly.
- Confirmed local likely results retain source-scoped SHA-256 fingerprints, no raw message/contact text. Reopening identical text on that service is ignored even in another chat. History is not timed out; pausing that service resets it. Storage is bounded to 20,000 hashes per service; errors/unconfirmed results are not remembered. Old in-flight results cannot repopulate a reset epoch.
- WhatsApp red outline and red Potential scam heading restored around the local explanation. Email red banner retained; Trust this sender action reconnected. Link warning cyan text restored.
- Native acrylic tint made less opaque with a brighter cyan glass border and gradient primary action. Windows accessibility/compositor settings still determine whether acrylic is available; opaque fallback remains.
- Refreshed pinned uAssets GPL-3.0 domain subset at commit 328cbf1a6f839ee5f59c49fda0690ef96c4f05d0, expanded from 500 to 1,690 supported hosts. No listed destinations visited; this is reported risk evidence, not fresh proof of malware.

Verification: 170 extension tests pass, including persistence, isolation, reset epochs and direct native opening; native build with installed scanner pins preserved; native smoke and jobs pass. Installed all six known extension folders, verified transport hashes; backed up prior console. Owner still needs to reload extension and refresh sites for loaded scripts to change. Live Chrome display/click and desktop acrylic acceptance remain unverified.
