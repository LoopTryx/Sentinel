# Prattyush changes for v3

Owner-requested branch: `prattyush-changes-for-v3`. Created 14 October 2026.

This branch keeps the owner's requested changes together for review and inclusion in the next Sentinel version. A commit here is **not** an installed update, a main merge or a release.

## Base and preserved work

- Base: `55b7bb958f1af891f988b5e388c01b2eec8c6a32`, Engineer A's desktop-v2 branch / PR73. This preserves the v2 account workspace, password tools, tray behavior and automatic extension connection. The stacked dependency must be integrated before, or alongside, this branch; do not replace main with this branch.
- New scam-detector work comes from Engineer B PR72, final compact-warning source `168059a4682ce2402ce0823a255e2c97a6fa82c5`. Its published history remains intact.
- Earlier desktop/extension design work is recorded in PR68, PR69 and PR70. Existing v2 design is retained, not replaced with the older Engineer B application snapshot.
- No USB blocking/service/watchdog changes are included. Those remain a separate security-reviewed handoff on PR74.

## Changes recorded

| Date | Owner request | Current state | Checks / remaining work |
| --- | --- | --- | --- |
| 14 Oct 2026 | Improve scam detection without changing the existing chat flow | Code included: normalization, English/Arabic categories, configurable combination scoring, proximity, local link naming analysis, tiers and reasons | Focused 19 tests passed in this v2-compatible checkout. Independent review and actual installed-browser validation remain pending. |
| 14 Oct 2026 | Remove the large WhatsApp report/settings panel | Code included: small red badge and a brief two-line explanation; no inline sender selectors, checkboxes or feedback dashboard | DOM tests cover expansion, compact structure, recycling and latest-100 cap. Scoring is unchanged. |
| 14 Oct 2026 | Preserve the current v2 UI and extension features while updating | Code included: v2 popup/account/search/auto-connect files preserved; release manifest key and permissions preserved; extension version 0.2.3; new detector modules declared | Desktop UI/native frame builds passed; all 83 extension tests and build/package parity passed. Independent review still required. |
| 14 Oct 2026 | Keep the chosen scam URL design | Existing v2 red gradient, mascot, shadow and looping wink retained | No surprise redesign. |
| 14 Oct 2026 | Update the currently installed app and extension | **Not installed**: prepared source/build only | Browser automation stopped because Opera's current URL could not be verified. No installed desktop/extension files were replaced in this update attempt. Owner now wants to collect changes for v3. |
| 14 Oct 2026 | Add staged Gmail/Outlook scam checks, preserving WhatsApp | Stage1 implemented and shown: local bounded readers, isolated provider selectors, exposed headers, link/attachment metadata, transient cache and observer cleanup | 13 extraction +12 WhatsApp regressions /96 total extension tests/build/parity PASS. No real inbox permission or content-script activation. Scoring, sender history, technical checks, banners and >=100-email corpus remain later stages. See docs/evidence/email-stage-1.md. |

## Evidence and limits

- Editable policy: `apps/extension/data/message-detector-config.js`.
- Synthetic corpus: `apps/extension/test/message-detector-corpus.json` (80 labeled messages).
- Before/after evaluator: `node apps/extension/scripts/evaluate-messages.mjs`. The prior PR72 corpus comparison was 21 false positives / 9 false negatives before versus 1 / 0 after; this is an authored synthetic comparison, not field accuracy. Rerun when policy changes.
- Engine accepts explicit sender context; the compact inline adapter uses unknown context. No automatic contact recognition or history-change detection is claimed.
- Raw message uploads and optional LLM classification remain disabled. Feedback helper is retained as a library; no new inline controls are installed into v2's existing account popup.
- Full repository verification passed for PR72's prior source. This v2 integration has focused tests/UI/native builds; a new full gate, independent peer review and installed-browser acceptance are still needed before release.
- The new integration test initially caught the release key missing from the development manifest (v2 normally injects it during packaging). The public release key is now included explicitly; the test confirms the existing `cjmdcjnpmnpebifncdejcmhkgapnjdhh` identity and native connection permissions. No private key is included.
- Branch creation does not change app release numbering: desktop remains based on v2; v3 packaging/versioning is a later release step.

## How to record future changes

For each owner request, add a dated row above: **what was requested → what changed → checks → what remains**. Commit the matching code on this branch. Clearly mark ideas as **planned**, finished source as **implemented**, checked builds as **tested**, and actual machine updates as **installed**. Never mark a request done solely because a preview looks right.

Keep the changelog and PR description aligned with the final requested behavior. Use normal fast-forward pushes and preserve other contributors' files. Coordinator integration, security review and release gates remain in force. No automatic merge or release is authorized by this branch request.

## 14 October — email detector draft

Implemented Gmail/Outlook reader, local scoring/config, technical clues, explicit site opt-ins, address-only sender history and compact warnings/link confirmation. Added 120 evaluation fixtures and measured results. WhatsApp flow stays intact. See [email draft evidence](evidence/email-detector-draft.md). Public-corpus recall is poor; not release-ready. Independent review and actual inbox acceptance remain. No installed extension changed.

## 15 October — extension download continuation

Added semantic email request patterns, truthful per-provider reader status, warning-to-trust-settings navigation, plain-text URL clues and stale-link/snapshot checks. Extension test build version is 0.2.4; release identity/native connection permissions are preserved. Owner requested a repository ZIP without creating a release. Detection still misses 31/50 public phishing examples; real inbox acceptance and independent review remain open.

## 15 October — email warning frame and mascot footer

Owner requested replacing the squeezed Gmail side warning with a frame around the email and warning below its body. Implemented deep-navy footer text, bright red gradient, blue-investigate mascot left and red-alert mascot right. Provider flex layout and message nodes stay intact; owned frame/footer clean up on reanalysis or disable. Checked wide and 390px synthetic previews plus DOM/data-preservation regressions. New extension test ZIP v10 / manifest 0.2.5 preserves v9 and the owner’s extracted v9 folder. Detection quality limits remain unchanged.

## 15 October — stronger red radial footer

Owner requested darker outer red, lighter central ring, better edge padding and a thicker email frame using ui-styling/ui-ux-pro-max. Footer uses a static radial gradient; spacing uses 16px insets/top gap and the frame increases from 2px to 3px with a closer offset. Navy text, mascots, message DOM and detection behavior are preserved. Checked 375px browser preview and existing UI regressions. New test package v11 / manifest 0.2.6; previous downloads preserved.

Owner follow-up: replace the custom lighter-ring variant with the exact layered radial background from warning-page.css (URL warning page). Deep navy text, 16px spacing and 3px frame remain. v12 / manifest0.2.7 supersedes v11 for this appearance.

Owner follow-up: enlarge footer mascots (112px desktop / 60px narrow), brighten radial centre while retaining dark red edges, and replace button borders/light surfaces with deep-navy buttons and light-blue labels. v13 / manifest0.2.8. Warning text/outline/padding/detection remain unchanged.

## 15 October — Cabinet Grotesk and button polish

Owner requested shadcn button styling, Cabinet Grotesk warning heading, clearer text, slightly darker centre and mascot shadows. shadcn CLI identifies this extension as Manual/no React/Tailwind; official Button guidance was consulted and adapted to existing semantic native buttons (not claimed as installed React components). Added local unmodified Cabinet Grotesk variable WOFF2 and accompanying FFL license for app UI, reference-counted FontFace registration/cleanup, larger/heavier warning copy, default/secondary borderless navy buttons with visible focus/hover/pressed/disabled states, reduced-motion support, and static mascot drop shadows. Font and license are included in build parity checks. No remote font requests, new permissions or detection changes. Browser preview access was denied by URL policy; no bypass attempted, so actual visual/font-loading acceptance is pending. v14 / manifest0.2.9 ZIP requested; earlier downloads and extracted v9 preserved.

## 15 October — larger typography, popup mascots and real scan alert
Darker email radial centre, inward 5px frame, navy popup and supplied ledge mascots; larger text across desktop/extension, Cabinet Grotesk desktop headings with Inter body. Validated suspicious/signature-match scan findings now drive the global red dashboard and visible alert across navigation; failures retain last evidence and preview resets cannot hide it. Quarantine UI stays unavailable. Evidence: docs/evidence/owner-ui-readability-2026-10-15.md.40 UI tests/build,119 extension tests/parity and full local verifier pass; installed/browser visual acceptance pending. Extension0.2.10 packaged as v15; earlier archives/extracted folders preserved. No merge/release.
2026-10-15 follow-up: Settings-first compact popup, hidden scrollbar with keyboard/wheel access, transparent lower CSS canvas and aligned ledges; inset centred concise email warning. Native source-launch worker was missing: repaired local staging and documented required build/stage step; failed scans now offer a clear retry message. Details: docs/evidence/popup-scan-repair-2026-10-15.md. No native authority edits, integration or release.
Final acceptance: full verifier PASS,40 desktop UI tests/build,121 extension tests, staged native file/folder session checks PASS; updated v3 desktop reopened. Extension v16 / manifest0.2.11. Browser visual and native popup transparency remain manual acceptance items.

## 16 October — larger popup, selection and interactive controls
Replaced black alpha fallback with the beige contrast canvas, enlarged the navy popup and cleaned its rounded border/mascot ledges. Bolder text and brighter muted text; desktop selection uses light blue/navy. Dashboard quick actions and capability/stat cards navigate to real pages with subtle reduced-motion-aware feedback. Email buttons require acknowledged actions; trusted senders opens/focuses the real full-tab form and save/remove works. Dummy preview callbacks removed. See docs/evidence/interactive-ui-actions-2026-10-16.md; no native authority, detection or permission changes. Extension v17 / manifest0.2.12; review and installed-browser appearance acceptance pending.
Validation:41 desktop tests/build,124 extension tests and full repository gate PASS. Functional email-action and real sender-store save/remove regressions included. Prepared v17 ZIP; manual browser appearance acceptance and independent review remain pending.

## 16 October — floating panel and true page background
Owner approved replacing native toolbar popup with a navigation-only panel injected on explicit toolbar click using temporary activeTab and optional scripting. Surrounding space is transparent to the underlying webpage; no beige/black outer canvas. Mascots hang outside the navy card. Settings/Passwords/preferences open secure extension tabs; no credential fields/data on the page. Restricted pages/permission refusal fall back to secure settings. Close, Escape, outside click, toggle, cleanup, bounded routes and concurrency covered. Full verifier/41 UI tests/build,132 extension tests and9 focused cases PASS. v18/manifest0.2.13; actual Chrome visual acceptance and independent security review pending. Details: docs/evidence/floating-panel-2026-10-16.md.

16 October follow-up: restored the native toolbar popup with mascot overlap inside Chrome's rectangular bounds. Email Trust this sender now directly saves the currently observed sender locally; success acknowledgement, retry, same-tab/document observation, opt-in and expiry checks. Current high-risk warnings remain. See evidence/direct-email-trust-2026-10-16.md. Native popup cannot have a mascot-shaped outer window through CSS; installed acceptance and independent review pending.

16 October: existing desktop info panels receive one shared navy/black glass style: static sheen, diffuse blue glow, bounded outer blur, tinted nested boxes, readable fallback and keyboard/reduced-motion states. Layout/content/handlers and extension unchanged. Tuning tokens and acceptance limits: evidence/desktop-panel-glass-2026-10-16.md.

16 October owner reference follow-up: remove global scan banner; compact Scan & Detect finding summary plus red threat theme. Reset console acknowledges displayed evidence without deleting reports and rearms on changed/new findings. More translucent blue/red glass and visible azure dither restored within existing performance limits. See evidence/glass-scan-followup-2026-10-16.md.

16 October: owner-provided layered glass style adapted into the navigation sidebar with collapse/expand. Icon rail retains labeled page buttons and focus; expanded menu restores labels. Existing Sentinel icons/pages retained, local assets only. See evidence/liquid-sidebar-2026-10-16.md.

16 October: owner-supplied GradientASCII backdrop (rose/rise/cell22/density.8) replaces the dither instance with bounded24fps/DPR1 and lifecycle/fallback safeguards. Console Shield Modules and USB summary removed; USB page retained. Sidebar scrollbar hidden, collapsed tail trimmed, expanded selection azure, collapsed icons hover/focus lift. Evidence: evidence/ascii-sidebar-2026-10-16.md.

16 October preset follow-up: ASCII background switches to owner blue/white/cyan horizon palette,cell18,density.8,same characters. Static fallback blue; existing24fps/DPR1/cleanup guards retained. Sidebar/Console/scan behavior unchanged.

16 October: owner-supplied Sentinel TextLoop ribbon added to a reserved bottom footer with16px edge gap. Exact owner preset, drag/hover pause plus keyboard and reduced-motion/lifecycle safeguards; same GSAP dependency. Evidence: evidence/text-loop-2026-10-16.md.

Owner requested revert of a92bdf5: restored the prior blue glass material, top counter row and Console copy. Kept the blue horizon ASCII background, collapsible sidebar and bottom Sentinel ribbon. Compact layout remains recoverable in Git history.

17 October: ribbon reduced to22px type/38px band, moved to natural end of scrolling page with full-bleed edges and16px bottom gap. Responsive line width keeps type size stable at wide/HiDPI sizes. Decorative sidebar slogan/version removed. Requested ui-styling/ui-ux-pro-max applied; evidence/small-flow-ribbon-2026-10-17.md.

17 October: sidebar restyled with shared premium liquid-glass tokens, subtle background-only refraction, paused/reduced-motion-aware blooms, synchronized500ms collapse, fixed icon slots and unclipped glass tooltips. Existing navigation/collapse state preserved; explicit owner tagline restored without version text. Matrix opacity25%. Evidence: evidence/premium-sidebar-2026-10-17.md.

17 October correction: restored the app-wide blue ASCII backdrop to its prior75% opacity. Removed the sidebar tagline/footer and trimmed its glass panel to the navigation content. The moving Sentinel ribbon remains at the bottom of the scrolling content and now reaches both horizontal edges without a reserved scrollbar gutter.

17 October: shared premium dark frosted-glass card base with24px blur,50% tint,28px panels/22px tiles,local Space Grotesk,muted headings,glass controls,status pills and varied20s corner blooms. Existing .panel/.stat cards inherit the base; Console cards explicitly use .glass-card modifiers. Layout/copy/actions preserved. Background25% follows the latest owner specification. Removed obsolete pointer glow work; reduced-motion/transparency,forced-color and solid fallbacks retained. Focused action/scan regression tests and UI production build passed. Desktop visual/GPU acceptance remains manual.

17 October: bottom Sentinel ribbon reduced to18px type/30px band. Full-bleed footer selector now takes precedence over later page styles; hidden content scrollbar removes the reserved right strip while keyboard/wheel scrolling stays available.

17 October correction: ribbon now occupies its own full-window bottom row, including the sidebar width, with no left/right inset. Removed shell/background wash and restored full ASCII opacity. The actual threat level switches the ASCII palette and GPU fallback to red; Reset Console uses the existing acknowledgement logic.

17 October owner adjustment: ASCII background opacity75% in both normal and red alert states; shell tint remains removed.

17 October correction: full-window ribbon now follows natural document scrolling instead of occupying a pinned row. The shell owns vertical scrolling; sidebar remains sticky and existing page insets remain. Top bar transparent; headings deep navy. Focusing an inner control no longer outlines the whole card in blue; individual keyboard focus rings retained.

17 October: transparent top bar promoted to a full-window first row; sidebar and page start below it. ASCII backdrop now covers the viewport continuously while scrolling, removing the flat blue cutoff at the bottom. Full-width ribbon remains in natural document flow.

17 October graphics recovery: info-box headings light blue. ASCII rendering now permits WebGL restoration and rebuilds resources after restoration. Hero receives a local dark gradient fallback, hides a lost canvas, rebuilds on restoration and caps rendering to24fps/DPR1/750k pixels. Automated ASCII loss/restoration/cleanup tests and UI build pass; actual GPU-driver crash recovery and usage still require desktop observation.

17 October: stronger headings/light-blue stat labels; neutral sidebar resting/selected button fills with blue hover/focus glow. Quick actions use clearer48px rounded glass buttons with visible focus/hover/disabled states. Ribbon reserves66px at the natural page end, resets its measurement/animation per navigation, and page navigation resets shell scroll with anchoring disabled. UI-UX Pro Max interaction/contrast guidance applied using existing controls. Nine focused tests and production build passed.

17 October: owner-provided glass pill button adapted into reusable GlassActionButton for Scan files/Passwords/Watchtower, with light-blue tint,navy labels,pointer highlight,keyboard focus and reduced-motion/forced-color support. Selected sidebar page restored to light-blue fill/navy icon and text. Seven focused tests/build pass.

17 October: restored the historical azure sidebar selection (#2f89e3 to #2265b5),transparent unselected rows with restrained hover glass/blue glow. USB Guard now uses the official Lucide USB symbol in the existing inline icon set with ISC attribution. shadcn CLI confirms no configured icon library/components; icon guidance applied without adding a UI framework. Six focused tests/build pass.

17 October: five owner-supplied local MP3 effects for opening,button/navigation clicks,scan completion and error/alert transitions. Quiet16/22% volumes,one active clip,repeat-error suppression,autoplay denial handling and persistent top-bar Sound on/off control. Assets bundled locally; no uploads/network playback.

17 October audio follow-up: eager preload/reuse MP3 clips; pointer-down playback and keyboard-click fallback remove click-release/loading delay. Opening sound attempts at startup,unlocks on a background gesture if autoplay denied without replacing navigation sounds. New flagged scan fingerprints trigger an alert even when already red; low-priority clicks cannot interrupt error/alert clips. Refresh button reloads the complete UI/background while leaving the runtime and scan evidence intact. Focused tests/build pass; actual device audio latency needs listening acceptance.

17 October: adopted Engineer A PR74 source at0d8509e onto v3,retaining B UI/sounds/extension and Input activity. Inline external-device list,native bridge and recovery containment included. Block remains gated; unsupported HID/storage Scan disabled. Full local verifier55 UI tests/native build/six focused native checks pass. No policy activation/operator installation or hardware proof. Evidence: evidence/usb-v3-integration-2026-10-17.md. Quarantine durable recovery/inventory-first plan: proposals/quarantine-v3-delivery-plan.md.

18 October: connected manual native-confirmed quarantine to Scan & Detect and the existing Vault UI. Durable authenticated inventory, fresh-process restore/delete, interrupted quarantine recovery, hash-bound actions and occupied-destination protection. Harmless Rust/runtime/UI/native boundary regressions added. Single selected files up to8MiB; independent security review and actual native-dialog acceptance remain release gates. Evidence: evidence/quarantine-v3-integration-2026-10-18.md.

18 October UI follow-up: compact Scan & Detect result cards and alert, highlighted page headings for Scan/Threat Log/Quarantine/Watchtower, brighter shared secondary text, rounded Vault controls with red destroy/blue restore icon animations, faster220ms sidebar width and60ms label delay. Successful native quarantine acknowledges the alert and returns the background to normal; declined/failed actions keep the warning. Sidebar navigation sound is decoded before interaction and leading silence trimmed, with an existing audio fallback. Focused regression coverage includes decline/success alert behavior; device audio latency remains listening acceptance.

18 October: all desktop page and card headings use shared deep navy ink on a light-blue highlight, with a forced-colors fallback. UI build passed.

18 October correction: light-blue highlight limited to explicit page titles; card headings and the home SENTINEL wordmark retain their previous treatment.

18 October: successful quarantine clears the active scan snapshot/alert, adds a direct Open Quarantine Vault action, and the Vault automatically selects an actionable stored file. Restore and Destroy regressions pass with native confirmation routes preserved.

18 October: restored GLM's existing HoldButton for Vault Destroy:1400ms red wave fill, rounded shape, keyboard hold and reduced-motion support. Completion opens the current native confirmation; no premature Deleted claim. Typecheck, three Vault regressions and UI build pass.
