# Popup, email spacing and scan worker repair — 15 October 2026

Owner follow-up to PR75 / source68fad7c, on prattyush-changes-for-v3.

## Scan diagnosis
The newly launched source checkout had no apps/desktop/console-build/sentinel-inspect.exe. The authenticated owned runtime reported scan.status=failed. The UI build alone was insufficient; the prior launch omitted native worker staging. Rebuild/stage the existing worker using tools/stage-inspection-engine.ps1 (byte-identity receipt), without changing native authority/inspection code. README source-launch instructions now include that missing step. ScanView displays an explicit retry message on failed status; report hashes/structural details are collapsed, with partial coverage and recovery limits retained.

## Extension changes
- Settings is first and selected on open; Passwords is second. Actual tab-handler DOM regression verifies switching both ways.
- Fixed600px native popup canvas, visible bordered inner card and aligned ledges; blue mascot is anchored22px above the card bottom so its image's ledge meets the border. Red ledge meets the top border. Full-width rules visually continue both ledges.
- CSS lower canvas is transparent. Chrome's native popup remains the containing window; no claim of drawing outside it or verified native-window transparency. Body does not scroll; the settings/account content region remains wheel/keyboard scrollable with its visual scrollbar hidden. Dashboard tab retains page scrolling.
- Footer branding and duplicate visible Settings heading removed. Core status/permissions/settings controls retained.
- Email frame offset16px inward, footer horizontal32px spacing (24px narrow), centred text/actions and concise fixed reason labels. Flexible footer basis/width and wrapping buttons prevent oversized footer sizing in flex providers. Narrow mascots scale to40px; desktop mascots remain112px. Owned style/font/marker cleanup and provider extraction remain unchanged.

## Acceptance
Browser URL-policy restriction still prevents visual automation. No alternate-browser, raw CDP or CLI screenshot workaround. Current actual Gmail/Outlook geometry, popup zoom/focus scrolling and native-window transparency need manual installed acceptance. Native checking uses only an authored harmless file/folder in an owned D: fixture directory; no real malware/EICAR, USB/HID restrictions, private inbox, raw private content or E: access.

Results are recorded in the PR comment after the final native worker and verification checks finish. No security/backend code, contract or permission change; no integration/release claim. Email detection quality remains experimental at the previously recorded FP4/70 and FN31/50.

Native evidence: staged worker SHA256 cde432d7d2c2979f496c4a178e69a669850745aaee8d7f3fc875e708bc3a1b52, source/staged receipt hashes identical. The same createNativeActionService used by runNativeScan completed one authored file and one folder, each with one completed report and none_observed verdict. Missing-executable reproduction returned unavailable. This is bounded read-only scanner/session evidence, not live malware efficacy or native-picker acceptance. New owned v3 GUI reopened (PID4288); existing installed-v2 instance was preserved. Initial relaunch correctly refused while the previous launcher's cleanup held its mutex; retry after cleanup succeeded.

An initial full verifier run overlapped native staging/hashing and hit the unchanged scan_bounds test's30-second production deadline (timed_out instead of limit_reached). No timeout/security code or test limit was weakened. Isolated7/7 recheck passed; the final full rerun passed that suite in7 seconds. Final extension121/121 and focused9/9 (including avatar-gutter alignment/ResizeObserver cleanup) passed. Complete final gate result is published in PR75 once finished.

Footer centring additionally accounts for provider avatar gutters using two bounded element geometry reads on mount/resize and a transform on the owned footer only; it does not change provider flow sizing or inspect message text. Resize observation disconnects on replacement/cleanup. No per-frame animation or layout polling was added.
Final full tools/verify.ps1 rerun: PASS, including40 UI tests, desktop build, native bounds/recovery/process checks and extension parity. Final dedicated extension suite121/121 PASS. Actual browser visual/zoom/transparency acceptance remains unexecuted.
