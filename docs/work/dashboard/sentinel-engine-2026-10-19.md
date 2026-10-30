# Dashboard and Sentinel scan integration

Owner correction: dashboard scans must use Sentinel, never Microsoft Defender. The previous Defender integration is superseded.

## Runtime

- `sentinel-sweep` reuses `sentinel-av::engine::Engine` for actual YARA and content/heuristic inspection. It does not run Defender, invoke a shell, contact a provider, execute inspected files, or change USB policy.
- Native-only root selection: Quick checks Downloads and Windows startup folders; Full checks internal fixed drives. External/network drives must be disconnected. Protected E: is excluded and its presence refuses system scans.
- Quick has a 120-second budget. Full has a four-hour budget; both cap traversal at one million inspected/skipped files and depth 64. The existing engine inspects at most 8 MiB per file. Skipped/inaccessible/partial/depth-limited content produces an incomplete result, never an all-clear.
- Completed Downloads arrivals use the same worker. File/ancestor retention prevents replacement during the check. Watching runs only while Sentinel is running; it is not a kernel interception service.
- Build embeds the worker SHA-256 in the console. Launch rechecks it while retaining worker and ancestors; renderer supplies only scan modes/switches. Cancellation stops the owned worker; closing the console terminates it. A bounded watchdog covers a stuck worker.
- Counts and up to 16 shortened paths plus signal names appear in native dashboard state. These are advisory findings, not quarantine capabilities. Existing Scan & Detect/native quarantine authorization remains separate.

## Detection and remediation limits

This worker uses existing bundled rules. The callback does not consult an external hash feed. Some rules deliberately recognize harmless test markers. It has no maintained comprehensive malware-signature feed and no automatic confirmed-malware quarantine path. It must not be described as Defender-equivalent protection or a finished antivirus. Existing manual authenticated quarantine is preserved; no heuristic or test marker authorizes automatic deletion/quarantine.

## UI

Less-rounded sidebar, unchanged hover expansion and conserved height; banner Device Overview label; removed duplicate overview and Windows Security widget/link; live GPU activity; matching 106x36 Refresh/Sound controls and one startup refresh animation; liquid-glass conversation rail/composer with reduced-motion/forced-color support.

## Evidence

- Native build: `artifacts/sentinel-own-native-final2.log`.
- Actual harmless download arrival -> retained file -> Sentinel Rust worker -> activity: `artifacts/sentinel-own-download-acceptance.log`, PASS, one file checked, zero skipped, zero findings. This is not malware/quarantine acceptance.
- UI focused tests: `artifacts/sentinel-own-ui-final-tests.log`, 5 files / 18 tests passed; production UI build passed.
- Browser fixture layout: `artifacts/dashboard-current-visual.log` and `artifacts/sidebar-current-visual.log`, no overflow, equal controls, height conservation and hover passed. Fixture metrics do not prove live hardware readings.
- Native hardware observation returned GPU activity 4%; this is the busiest engine across adapters, not per-card utilization.
- Full regression verifier and actual scan-mode acceptance results are recorded separately; do not infer full disk completion from successful launch/cancellation.

Independent review found and corrected missing findings details, silent depth truncation, stale counters, and cancellation/shutdown ordering. GitHub publishing remains unavailable; changes are local.

Final installed launch: artifacts/sentinel-own-installed-final.log (navigation=True, glass=true, Dashboard). Actual Quick result: 11,872 checked / 5 skipped / 2 advisory indicators, incomplete atbudget. Actual Full launch/Stop: 258 checked / 16 skipped / 3 advisory indicators, cancelled. Full verifier PASS; no full-disk completion or automatic quarantine acceptance claimed.
