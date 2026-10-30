# Shared password companion design and implementation plan

Owner approved shared-vault design on 20 October 2026. Scope: replace old browser fallback, fix scam adapter module loading, add persistent encrypted credentials shared by native console and extension, submit-time Save/Update prompt, selected-origin fill, compact generator. Preserve all existing integration work; no USB changes.

Architecture: native runtime owns AES-256-GCM encrypted vault, scrypt-derived master key, atomic replacement, bounded records, automatic idle lock. Extension worker owns short-lived pending submissions, exact HTTPS origin/frame/tab checks and explicit trusted-popup confirmation. No vault contents enter AI or telemetry. No browser credential-store scraping, keystroke collection or automatic cloud upload. Console reuses its current account workspace and adds unlock controls. Password rotation means changing a saved value, never changing a website account.

Implementation sequence:
- Reproduce missing web-accessible import dependencies in a recursive manifest test; fix both adapter graphs.
- Test vault persistence, wrong key, tampering, lock, capacity and origin restriction; implement encrypted store and authenticated runtime routes.
- Add browser Save/Update and selected-fill protocol with bounded transient captures and sender validation; test denied origins, forged callers, expiry and lock.
- Integrate popup generator/controls and console unlock with existing presentation.
- Build and run focused/full available tests; back up installed extension and deploy new dist. Reload Chrome and verify actual site coverage separately.

Acceptance requires actual Chrome login with synthetic credentials, restart/unlock, matching-origin fill and actual WhatsApp/Gmail/Outlook observations. Valuable-credential use remains subject to independent security review per project rules. Automated DOM tests do not prove current live-site support.

## Implementation and evidence

Installed extension 0.2.22 and matching console/runtime; old overlay-v18 preserved under artifacts/password-companion-backup-* and the prior Engineer B extraction. No USB rules or device operations changed. Console rebuilt using the previously installed scanner/signature resource pins, preserving those binaries.

Scam-loading root cause: recursive imports from WhatsApp/email referenced message-candidates.js and its helper graph without site-matching web_accessible_resources. The new recursive module-access regression reproduced the failure and passes after packaging the complete graphs. The source contextual local-AI gate remains likely-only, with bounded visible context; this change does not establish classifier accuracy or live-site DOM acceptance.

Vault: native Node runtime uses scrypt (N=32768, r=8, p=1), random salt, AES-256-GCM, authenticated version context, random IVs and atomic encrypted-file replacement. Master key stays in the native runtime and locks on idle or explicit lock. Metadata polling does not extend unlock lifetime. No sample accounts populate the production vault. Existing legacy fixture state envelope remains for compatibility; it is not the storage format.

Browser credentials are captured only at trusted standard-form submission after explicit tool enablement, not per keystroke. A separate extension-owned view offers Save/Update. Pending credentials are bounded, access-expiring and kept in trusted-only chrome.storage.session memory, not local/sync storage or URLs. This survives MV3 worker restarts; expired entries are purged when processing password requests and session memory clears with the browser. Background worker queues are bounded. Fill uses original tab/document ID, exact HTTPS origin and an explicitly selected field; cross-origin frames and ambiguous password forms are unsupported. Save remains bound to the captured submission origin even following a sign-in redirect.

The field button opens a compact cryptographic generator with 12–48 characters and selectable character groups. Preview, copy and fill use the same value. No operation changes a website account password automatically. Console and extension unlock the same vault. Master-password fields clear on hide/blur/secret revocation. A lost master password cannot be reset; backup/recovery/import UX and production credential qualification remain future work.

Independent review found seven P2 issues; all were corrected and rechecked: change-password field selection, redirected submission save, worker restart retention, status revision churn, preview/fill mismatch, remote-lock recovery and master-field revocation. Narrow review closed with no remaining P1/P2 findings; this is code review, not installed-browser acceptance.

Verified: 165 extension tests, 95 UI tests across 35 files, 8 runtime/native-connector tests; UI production build; extension build/parity smoke; native console compilation; native desktop window smoke; asynchronous job smoke. Installed file hashes and existing Chrome host registration match the updated build. The running runtime answers vault status and is initially locked/uninitialized. Receipts: artifacts/password-companion-installed.json and password-installed-verification.json. Full repository verifier recorded separately in artifacts/password-full-verifier.log.

Actual Chrome control is unavailable in this session. Owner reload of 0.2.22 and live WhatsApp/Gmail/Outlook plus synthetic login save/restart/fill checks remain pending. The installer artifact itself has not been rebuilt by this task. Source changes remain local; no GitHub publication is claimed.

Full workspace verifier: Rust formatting and lint completed; Rust test build stopped with E0460 cached-crate version mismatches (`object` / `wasmparser`) and a MinGW linker out-of-memory error. The full repository check is therefore not passed. This task changed no Rust source. The installed scanner binaries and their original embedded trust pins are preserved. See artifacts/password-full-verifier.log; focused password/extension/UI evidence above is separate.

## Owner follow-up: stale Chrome copy and USB dialog

Owner reported Chrome still displayed 0.2.20 and supplied a prize-pressure message that produced no visible warning. Investigation found both installed Desktop/apps/extension/dist folders were still 0.2.20 while the canonical ChromeExtension folder had been updated. Both installed source roots and dist roots now contain 0.2.22, backed up separately; receipt artifacts/password-all-extension-copies.json. The original installation script initially missed these alternative load locations; that deployment omission is corrected. Actual Chrome version after reload still requires owner confirmation.

The exact supplied prize message passed the candidate regression and the running installed native /ai-message workflow. Actual Qwen2.5 1.5B response: verdict likely, localError null, elapsed 10,548 ms. Receipt artifacts/owner-prize-message-result.json. This proves native local analysis for this example, not actual WhatsApp DOM extraction, browser notification delivery or classifier-wide accuracy.

Owner requested removal of the USB protected-settings error modal. UsbAdmissionWindow.Main now returns its failure exit status without blocking in MessageBox; all administrator, owner, location and ancestry checks remain in place. A presentation-only helper installer replaced ProgramData/SentinelUsbAdmission/Sentinel.UsbGuard.exe with a protected backup, retained the existing Rust compiler pin, and verified the worker manifest unchanged. No worker, policy, scheduled recovery task or device restart was installed/executed. Receipt artifacts/usb-popup-install-result.json reports ok=true. Any already-open modal belongs to the old mapped process and may need to be dismissed once.
