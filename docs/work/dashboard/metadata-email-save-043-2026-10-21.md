# Metadata browsing, email consultation and save suggestions - 2026-10-21

0.2.43 addresses owner request to remove email report/trust actions, browse all saved account metadata without Hello, fix Learn more, and save new/changed sign-ins.

Native ai.inbox now replies with the queued finding before awaiting slow quick-explanation notification work; prior ordering held the console handoff while model work ran. No email/cloud upload changes. Email banner no longer appends Report wrong flag/Trust this sender controls. The AI card retains Learn more.

Native list path now decrypts via this Windows user's existing DPAPI key under PasswordActionLease without Hello, returns only password-stripped account metadata, and creates no fresh vault if key absent. Browser manager retains exact frame/document grant. Field picker lists all accounts; other-origin accounts remain disabled for fill, exact origin/document/field backend checks unchanged. Reveal, copy, fill and mutations still require Hello. User request's only-on-reveal/change phrasing is implemented for metadata browsing, with explicit Hello retained for secret-bearing autofill/save operations.

Content detects form submit and subsequent form removal/hiding/path change; after navigation a no-password-field page can suggest save for bounded same-tab same-origin transient capture. Native save requires Hello; saves origin/name/user/password and updates matching origin+user. This heuristic does not prove successful authentication and is a save suggestion rather than silent verified login capture. Failed-login suggestions may occur; cancel preserves bounded transient capture until expiry. No universal cross-origin SSO success signal claimed.

Verification:43 focused password/message tests passed before final navigation adjustment;32 password tests rerun after adjustment passed. Native bridge and console compile passed; extension build/parity passed. Independent authority review found no blocker; exact-origin and other-site disabled state preserved. Additional email/transport combined invocation stalled and was interrupted, not a passing full-suite result. No real password used or private email opened.

Installed six extension folders0.2.43 hashes checked; native bridge and console hashes matched. Installed startup navigation/glass/Dashboard confirmed. Real Chrome reload and Learn more/Hello acceptance remain owner checks. No installer generated.
