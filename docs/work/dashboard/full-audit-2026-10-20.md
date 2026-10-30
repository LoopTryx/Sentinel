# Sentinel application audit — 20 October 2026

Scope: the current installed desktop and extension build, native/runtime source, console views, browser adapters, vault authority, scan lifecycle, notifications, local AI, history, packaging and release readiness. Reviewed the existing dirty integration checkout at base 0bc3206699e4297ffc4b5dfc1b663070544c69c9; no source commit, push or new installer was produced. This is a source and bounded local acceptance audit, not an independent malware efficacy certification.

## Fixes implemented and installed

1. Native alert WAV is embedded in the console, used by manual scan completion, cancellation/incomplete/failure notices, threat notices and AI scam notifications. Older detailed-inspection UI alerts route to native playback too. Sound off is persisted and synchronized; muted alerts do not play. A 500 ms coalescing guard avoids overlapping identical bursts. Repeated identical scanner-startup failures are not announced on every retry. Audio failures cannot discard scan results.
2. Generic browser state no longer exposes saved real-vault names, websites and usernames after another client unlocks. Passwords were not exposed by this issue. Native desktop state retains metadata for its Hello-gated console view. Real vault mode now explicitly reports encrypted_vault; both consumers validate this mode separately from synthetic_demo.
3. Browser vault status failure clears visible metadata and returns to its verification gate. Console vault status failure also revokes local viewing access. It no longer continues to look connected/protected after losing the runtime.
4. The inline local-explanation wait now covers the bounded CPU model generation window, rather than timing out after about 35 seconds. Real-model acceptance tests were updated from an obsolete 12–14 second polling assumption; no fixture result is substituted for model output.

Installed extension: 0.2.34, across all six known copies. Native console and UI updated with a rollback backup recorded in artifacts/audit-installed.log. Chrome still requires the owner's reload of its loaded extension. No USB rules were activated or altered, and E: was not scanned.

## Windows Hello and master passwords

New vaults already require no user-created master password. Native Windows Hello verifies access and sensitive operations; a random encryption secret is protected using current-user Windows DPAPI. Browser pages do not collect a master password. A legacy encrypted vault may require its previous password once in the native migration dialog so saved logins can be preserved. Removing that requirement without decrypting would lose access to existing encrypted records. No real-vault migration was performed during the audit.

This design does not claim hardware-bound secrecy against arbitrary code running as the same Windows user. Hello is the application's approval gate; DPAPI protects stored key bytes. Clipboard copy currently has no automatic expiry or guarantee that Windows clipboard history/cloud sync excludes copied passwords. That remains a documented privacy limitation.

## Feature assessment

| Area | Evidence checked | Limits / remaining acceptance |
| --- | --- | --- |
| Device overview | Bounded WMI collection, unavailable/error states, responsive text, UI tests | Actual hardware counters/GPU driver behavior were not visually accepted in the native window. |
| Quick/full/selected scans | Scope and terminal-state handling, pinned engine startup, harmless selected-file execution, native session cancellation/deadline tests | Full-drive completion and effectiveness against real malware were not established. Files/archives have bounded coverage; skipped content must remain visible. |
| Automatic Downloads checks | Stability/partial-download exclusion, reconcile/cancellation code and fixtures | Runs while Sentinel is open; not a kernel execution interceptor. No live malicious download used. |
| Quarantine/restore | Native retained-session tests with harmless bytes; encrypted-vault persistence, tamper and origin tests | Not a general ransomware rollback or complete AV parity claim. |
| Alerts | Actual harmless selected scan produced exactly one completion notification callback; WAV decoded; mute/enabled/error-isolation checks pass | Audible speaker output, OS notification settings and minimized presentation need owner acceptance. |
| Sentinel AI | Four actual CPU inference tests; source/excerpt/context, cancellation, likely verdict, authenticated return and inbox routing | Response time varies; recent synthetic runs took several to around 17 seconds. NVIDIA credentials/cloud inference were not exercised. |
| Saved conversations | User explicitly approved a read-only decrypt-and-schema check; it passed without displaying or uploading conversation content | This does not prove every UI history transition or resolve a stale installed-window error by itself. |
| WhatsApp/Gmail/Outlook | Permission/source/document checks, extraction fixtures, context handling, inline lifecycle, notification deduplication | Real logged-in Chrome tabs and changing provider DOM remain unverified in this audit. Empty prior history is not proof of fraud. |
| Harmful links | Exact-tab/address continuation lifetime, URL validation, risk-list/wording distinction and tests | Bundled list freshness is visible; list matches and wording are not live website malware scans. Continuing does not globally trust a domain. |
| Password manager | Hello broker fail-closed source review; DPAPI synthetic key round-trip, atomic key creation, encrypted migration tests, origin-bound browser fill | Owner must accept real Hello/PIN and any one-time migration. Same-user execution and clipboard limitations remain. |
| Watchtower | Passive local Wi-Fi/configuration observations, coverage validation and UI tests | It does not secure the router, inspect all traffic or prove absence of hostile devices. |
| USB Guard | Source review of stale-state/approval guards and coverage messaging | No daily-machine USB/HID blocking performed. Device/model coverage and recovery need isolated hardware/VM qualification. |
| Installation | Current sources compile; prior V5 package integrity receipt remains available | Existing V5 installer predates 0.2.34/sound/privacy fixes. No refreshed installer produced. Clean Windows 10/11 install remains unqualified. |

## Verification

- 245 runtime/extension tests pass, zero failures, five optional tests skipped in the normal suite. The installed native inspector was explicitly configured. An unconfigured initial run failed native tests; a resource-sensitive cancellation failure during concurrent linking passed after the workload ended and disk space was recovered.
- Four real local CPU model acceptance tests pass separately, with no cloud request. These cover four normally skipped tests. The optional legacy ClamAV executable test remains skipped; the installed persistent engine was tested independently with a harmless selected file.
- 97 UI tests pass; UI typecheck/build succeeds. Extension source/dist parity smoke passes.
- Real harmless scan -> exactly one native completion notification callback passes. Alert WAV decoding, mute/enabled dispatch and audio failure isolation pass; tests do not claim human-audible playback.
- Synthetic DPAPI key round-trip, non-overwrite/atomic publication and invalid-Hello-owner refusal pass. Real vault contents and passwords were not printed or migrated.
- Desktop process job success, failure, timeout, cancellation and argument-quoting tests pass.
- Rust formatting and workspace lint passed. The full verifier then failed with cached dependency mismatch/compiler errors. A targeted cache repair progressed to linking, where disk space ran out. Ten newly produced rebuildable test executable/debug artifacts were removed to recover about 3.55 GB; source, production binaries, vaults and installers were preserved. Rust workspace test completion remains unverified. Generated contract files have no new diff from this audit.

## Computer-use and release gates

The requested computer-use skill was read and initialized, and its application inventory was queried. Its guidance explicitly forbids operating anti-malware apps, password managers and authentication dialogs. Browser tooling exposed only the in-app browser, not the user's Chrome connection. These restrictions were not bypassed through another automation method. Native UI/Hello, real Chrome rendering, audible playback and device coverage remain owner-operated acceptance checks.

Automatic approval review initially rejected the private-history diagnostic because it would decrypt real conversations. The owner then explicitly approved it; the check succeeded and printed only the format/readability result.

Independent read-only review found the metadata and stale-connection bugs above; their fixes and sound integration received a second review with no blocking finding. This does not mean the whole app is vulnerability-free.

Before refreshing the installer: complete owner Chrome/Hello/sound acceptance, obtain a successful full Rust build/test run on a machine with sufficient build storage, and qualify the install on clean supported Windows systems. Keep the existing AV enabled. No comparative percentage against commercial antivirus is supported by this audit.

## Follow-up: native startup compatibility regression

Owner screenshot exposed a missed native consumer after the real-vault mode fix. GlassConsole.Initialize still required synthetic_demo; a valid encrypted_vault runtime threw InvalidOperationException and showed the generic could-not-load screen. RuntimeReadiness now explicitly accepts both supported connected modes and rejects malformed/unknown/disconnected snapshots. Its regression test failed before the fix and passes afterward. Native build installed with rollback backup. Installed startup evidence confirms navigation=True, glass=true, heading=Dashboard, backend=demo_runtime; installed console SHA256 matches the repaired build. Actual WebView2 local-assets smoke also passes. The smoke script's obsolete Console heading was corrected to Dashboard. No real vault or authentication interaction required for this repair.

## Follow-up: no master-password entry

Owner explicitly requested removing the master-password requirement. WindowsVault no longer contains the migration PasswordBox. A previously unlocked vault can be rekeyed behind Hello while preserving accounts. A locked legacy vault that cannot open with the pending Windows-protected key now offers an explicit native Yes/No choice: create a fresh Hello-only vault and retain the original ciphertext at a unique sibling backup path. No real vault was archived, decrypted or reset by the agent. New-vault confirmation and Hello remain owner actions. Tests verify archive bytes are unchanged; interrupted creation retains the pending protected key and legacy backup. Existing final-key handling is unchanged. No in-app legacy restoration was added.

Native connector and console compiled and installed; all six known extension copies updated to 0.2.35. Eleven focused runtime/extension tests, 97 UI tests, DPAPI/atomic-key/backup tests and independent read-only review passed. Installed connected startup confirms Dashboard. Installer has not been refreshed. This section supersedes the earlier recommendation for a master-password migration dialog.
