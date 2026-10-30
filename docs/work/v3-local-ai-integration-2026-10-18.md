# v3 integration and local AI — 18 October 2026

## Source and preservation

Integrated Engineer B's `origin/prattyush-changes-for-v3` at `7967e35` by applying its changes after `ff8ee59` with three-way merges into the existing dirty Engineer A checkout. B's active branch was not edited or pushed. Existing unpublished USB, AI, extension and audio work was backed up before integration. Conflicts were resolved to retain A's Windows Hello USB flow and AI routes alongside B's quarantine, Watchtower, mascot, focus behavior and extension overlay changes. Older context-detector branch work was reviewed; its older detector chain was not replayed over B's newer payment/context logic.

Only the imported unchanged quarantine contracts/generated bindings are committed locally as `7f4b954`, with B coauthor attribution. The remaining combined work remains in this checkout, not published. No main merge or release.

## USB incident and current status

The real protected diagnostic returned `InvalidOperationException 80131509 An interrupted USB decision requires recovery`. The code is generic; the pending protected transaction is the specific observed reason. Existing authenticated recovery completed. The owner then reported built-in keyboard input absent. Guard was released through the original Windows Hello workflow and verified inactive, but the keyboard remained nonfunctional despite native Started/problem0 status. Exact built-in ACPI keyboard restart returned 3010, requiring a Windows restart. Why that keyboard lost physical input has not been established. Do not claim the exclusion guarantee is physically qualified.

Guard remains off. No new blocking trial was performed. The operator-only update verified inactive/no pending state, retained protected backup, and did not install a new worker or change USB rules. It exposes `usb_recovery_required` rather than hiding the known pending-decision reason behind a list error. The switch reflects allowed policy state only, never an optimistic physical-enforcement claim. Scan remains honest about unavailable HID/firmware scanning.

Successful linked decisions are persistent already: HID snapshots report persistent=true/deadline=null. The five-minute Request rollback deadline bounds an incomplete transaction; it is not a successful block expiry. Crash rollback was preserved. No global recovery tasks or foreign policy were deleted to satisfy a request to remove timed block expiry.

## AI and context

Console defaults to on-device Qwen2.5 1.5B Instruct Q4_K_M. NVIDIA remains explicitly selectable. Official pinned model revision: `91cad51170dc346986eccefdc2dd33a9da36ead9`; SHA256 `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e`; file1117320736bytes. Runtime remains existing hash-pinned llama.cpp b11718, CPU2threads, loopback authenticated, GPUlayers0. No arbitrary endpoint or unverified model execution. No real NVIDIA request was made during these tests.

Chat messages save in native current-user DPAPI encrypted storage, owner/SYSTEM file ACLs and atomic replacement. File under LocalAppData/Sentinel/PrivateHistory/chats.dat. Same-user processes are not isolated by DPAPI. Completed messages only; no unsent drafts, resumed jobs or restored authoritative finding references. Bounded24chats/60messages with oldest text evicted to stay below500000serializedcharacters. Delete saved chats is available. Cloud does not automatically receive saved chat history.

Candidate phrase library covers over100 phrases across urgency, accounts, credentials, payments, rewards, investments, impersonation, secrecy, jobs, delivery, remote support, coercion and purchases. Keywords select candidates, never prove fraud. Qwen outputs validated likely/unlikely/uncertain plus explanation. Contradictory likely/protective-advice responses are held uncertain. No production accuracy claim.

WhatsApp uses supported rendered incoming message nodes; context is up to3 prior supported visible incoming messages. Gmail context is up to3 prior expanded messages within the current main thread. Outlook retains current-message analysis without pretending tenant-specific prior-thread extraction works. No scrolling, hidden/collapsed text, controls, contact directories or unrelated inbox/history are collected. Prior context uses the existing bounded visible-text walker excluding Sentinel-generated text, then best-effort secret/identifier redaction. Context is an untrusted message_context signal, not verified detector evidence. Local likely verdict queues the desktop warning workflow; uncertain/unlikely candidates are not automatically announced. Existing deterministic email evidence banners remain separate.

The same redacted context signal accompanies a finding when the user selects NVIDIA. Actual NVIDIA context acceptance is pending; API key stays native Credential Manager. Local CPU queue bounds8; console Stop owns console jobs and cannot cancel another message classifier. Browser Learn more uses the existing extension-owned continue/open-app page. Desktop notification closes after5seconds.

## Verification

- Unchanged tools/verify.ps1: all available T01 checks passed, using CARGO_BUILD_JOBS=1 after parallel Rust compilation exhausted memory. UI80tests; Rust fmt/lint/tests, TS, extension smoke all passed.

- Extension entire suite:152PASS0fail.

- Runtime entire suite with SENTINEL_TEST_INSPECT pointing to staged new B engine:66PASS0fail5optionalacceptance skipped. Earlier run without the mandatory variable failed; it was corrected rather than hidden.

- Actual CPU synthetic contextual Gmail journey: PASS native-auth transport, likely verdict, browser result, native inbox, retained prior context; no NVIDIA request.

- CPU timing on this laptop: cold greeting6706ms; prize/gift-card classification5571ms; protective advice1705ms and unlikely. i3 10th-gen latency/RAM acceptance NOT measured. A first prompt falsely flagged protective advice; revised prompt/schema and contradiction handling were tested. Three synthetic examples are not an accuracy benchmark.

- Native history test: DPAPI roundtrip, absence of plaintext, tamper refusal, delete PASS.

- Independent review:15focused regressions PASS; hidden-context/cancellation findings corrected before installation.

- Integrated native console compiled; inspection engine built/staged with hash receipt.

- Isolated Chromium preview: no render errors or horizontal overflow at1120x800 and900x700. Fixture preview is not installed Chrome acceptance.

## Installed copy and remaining acceptance

Copied new UI/runtime/native console/inspection engine/extension0.2.20 and pinned Qwen model to the existing Sentinel Desktop installation, with backups in artifacts/v3-installed-backup-20261018-175952. Replaced the user's existing Downloads/Sentinel-Extension contents without changing extension identity. Key configuration and USB worker/policy were left untouched.

Launcher command ran, but a fresh installed render receipt was NOT observed. The attempted direct-launch/process/event diagnostic was not executed: automatic approval review could not complete because account usage limit was reached. This was a review infrastructure failure, not an unsafe-action determination. Do not bypass approval. Owner action pending: open desktop shortcut, reload extension0.2.20, refresh supported page, confirm new sidebar/switches and live workflow. Native new encrypted-history persistence across actual installed restart, actual-site DOM acceptance, cloud-context response and i3 hardware timing remain pending. General USB restart persistence/internal-keyboard safety remain unqualified; leave Guard off pending diagnosis.

## Installed startup repair

Owner screenshot confirmed generic startup failure. Installed runtime imported shared extension source modules missing from the incremental copy: message-candidates.js and email/providers/shared.js. Copied matching src/data dependencies and corrected package-demo.ps1 to include them. Actual installed runtime import/start/shutdown passed. Direct installed Sentinel.Glass.exe --app launch stayed running and produced a fresh glass-smoke receipt at22:05:23: navigation=True, glass=true, heading=Console. No USB policy changes.

## Local v3 interaction/installer follow-up

Owner explicitly revoked publishing: no GitHub release or Chrome Web Store upload. No push performed.

Sidebar uses stable height in collapsed/hover/pinned-expanded modes and equal42px rows; collapsed icon slots centered. Isolated Chromium measured identical536px rendered height with widths76px collapsed/238px hovered at the test viewport. Native F11 and WebView F11 forwarding provide fullscreen without adding a maximize button. Enter submits; Shift+Enter and IME composing preserve editing. UI82tests pass. Installed console rendered fresh22:23:23; Chrome extension page was opened. Owner physical F11/hover check pending.

HelloStartup checks the actual UserConsentVerifier availability before standalone boot and offers a fixed Windows sign-in Settings action, PIN instructions, Retry and Cancel. Actual availability=Available on this laptop. Missing/disabled/busy-user states not physically exercised. No biometric data is read or stored.

Local v3 payload includes UI, extension source/data/dist dependencies, native console/inspection engine, pinned CPU runtime/models/licenses and guided extension setup. No API keys, chat store, runtime token config, session key files or machine-specific protected USB enrollment are included. Current review found no new installer security blockers; extraction still enforces contained paths, no symlinks, bounded sizes/file count and file manifests. Large model requires1.5GiB per-file/3GiB total extraction bounds.

Chrome on ordinary unmanaged Windows requires a Web Store distribution or developer-mode approval; owner rejected publishing, so bundled extension has guided one-time setup. No Chrome Preferences edits, enterprise-policy workaround or silent-install claim.

Requested automatic model-profile/keyboard-plus-storage blocking is NOT implemented or activated in this update. The existing enforcement mode remains off after the built-in keyboard incident; broad protection cannot be represented as reliably excluding built-ins on every laptop. A composite HID+storage device is a review signal, not proof, and a storage-free injector would be missed. No tested general-enforcement or automatic re-enable claim.

## Publishing reauthorized

Owner subsequently explicitly requested publishing v3 installer/source and pushing working progress; this supersedes the earlier no-publishing instruction for GitHub only. No Chrome Web Store publishing authorized. Native F11 regression reproduced wrong1920x1080 exit and fixed deferred HWND bounds: boot1080x740/restored1080x740 passTrue exit0. v3 release notes document Guardoff and unfinished automaticprofile-only enforcement for v3.5.

### Final release branding and fullscreen
Owner supplied the shield/S logo. Image editing removed the wordmark and background; source PNG is assets/brand/sentinel-shield.png. tools/build-brand-assets.ps1 generates multi-resolution ICO and PNG assets. Console, tray, launcher, setup, shortcut, UI and extension use those assets. No USB policy behavior changed. Native branded fullscreen smoke: boot 1080x740, restored 1080x740, pass=True, exit 0. Embedded icons decode successfully. Independent review found no branding blocker. Final verifier initially encountered sandbox temporary-directory access denial; native-access run passed filesystem stages and caught the action-default-icon assertion, now corrected to preserve the no-popup contract and verify actual PNG dimensions.

Final branded verification: unchanged tools/verify.ps1 passed with CARGO_BUILD_JOBS=1; UI 82 passed; expanded extension suite 152 passed/0 failed with native loopback access (sandboxed mock-HTTP test did not exit). Installer --extract-only returned 0 and tools/install-desktop.ps1 -TestInstall completed in artifacts/v3-branded-install-test without modifying live registrations or policy. Branded native fullscreen smoke returned 0, boot/restored 1080x740.
