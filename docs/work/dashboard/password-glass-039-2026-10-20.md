# Password popup glass, sizing and Hello continuation - 2026-10-20

Owner requested removal of reserved bottom space, liquid glass, a wider rectangular vault matching the console's account list/detail layout, and a single Hello approval.

0.2.39 removes legacy stage min-height/padding and footer/mascot allocation inside the embedded viewport. The card uses a full-height flex layout with scrolling main content; its parent expands to 860x620 CSS pixels within viewport bounds. Actual page backdrop blur lives on the parent card; embedded HTML/body/iframe surfaces are transparent with translucent tint. Reduced-transparency and forced-colors fallbacks remain.

The unlock handler previously dropped a successful response when visibilityEpoch changed during Hello. Explicit unlock now accepts upon visible completion, or defers metadata until return, revalidates live status, then opens without another Hello. Hidden locked runtime, failed status, pagehide and closed document do not accept cached success. Secret reveal action epoch and focus clearing remain unchanged. Account health metadata is now shown when supplied by the shared vault, alongside shared account fields.

Verification: 41 focused password/overlay/harness regressions passed; extension build and parity smoke passed. Independent review of deferred status/closed handling found no remaining blocker. Synthetic browser preview verified wider list/detail view with no outer bottom reservation; no real vault or Hello UI was accessed. Screenshot artifacts/password-glass-039-preview.png. Real Chrome Hello focus behavior remains owner acceptance.

Installed all six preexisting extension locations at 0.2.39 with backups and changed-file hashes checked. Receipt artifacts/password-glass-039-installed.json. No native binary/installer changes.

The first visual-server command was rejected by automatic approval review due to LAN exposure of private source. Replaced with a localhost-only listener; old task preview listeners were stopped. No blocked action remains.
