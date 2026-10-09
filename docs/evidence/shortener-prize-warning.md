# Known-shortener reward warning candidate

Owner regression: bit.ly/free-prize was not matched by the paired reward/payment rule. Add rule9004 for reward path tokens on exact bit.ly, tinyurl.com, t.co, is.gd hosts; query mentions and suffix impostors stay excluded. No destination fetch or confirmed malware claim.

Priority: sourced listed-domain20, paired keyword10, shortener9. Thus overlapping prize-payment retains keyword classification and reason-code mapping. warning.html#shortener emits only suspicious/shortened through the existing strict top-frame ingress.

Status response adds active (any owned rule present), upgradeNeeded (owned rules incomplete), siteAccess, preserving enabled (all current rules plus access). Controls use active for Pause, show older-rule upgrade status, and require pause/re-enable for installation migration. Disable removes only IDs9001–9004.

Evidence: two review regressions failed before correction; focused navigation/warning14 passed, independent navigation/transport12 passed, no new review blocker. Full repository verification log: .local-handoff/shortener-review-verify.log. Installed browser and Chrome rule registration for this candidate remain pending; unit review is not browser acceptance.

Acceptance: disposable Chrome register rules and inspect overlap without fetching hostile links; supported installed Chrome reload, pause/re-enable, ordinary Enter controlled warning; verify benign ordinary shortener and suffix/query negatives; paired desktop bounded event. PR56 is prerequisite. Existing v1.0.0 tag/asset unchanged; whole issue14 remains open.

## 9 October controlled Chromium acceptance

Exact f56b52f source extracted to a disposable directory and loaded in a fresh profile. Test-only manifest declared HTTP/HTTPS access; production optional permissions and owner profile unchanged.

- Chrome accepted all three regexes and registered9001–9004.
- testMatchOutcome: bit.ly/free-prize matched9004; bit.ly/prize-payment selected9002; ordinary shortener, suffix impostor and query-only prize had no match.
- With network offline, actual navigation redirected to #shortener/#keywords and rendered the distinct truthful explanations.
- Separate actual local demo runtime paired to disposable extension: with external page requests aborted, warning bootstrap/service-worker/HTTP delivered only suspicious/[shortened] and suspicious/[reward_payment] into desktop-authorized runtime state. Context and owned runtime closed in finally.
- Old persisted3-rule simulation returned active true/enabled false/upgradeNeeded true. Pause cleared owned rules; re-enable installed4 and cleared upgradeNeeded; subsequent render and receipt still passed.

Reproduction: use exact source in disposable Chromium only, test-only declared host access; register makeNavigationRules(), query testMatchOutcome() with the above positive/negative URLs; remove9004 and call navigationWarningStatus()/setNavigationWarnings(false/true); abort non-loopback network before navigation; pair a fresh startRuntime() instance to exact extension ID and inspect authorized /state for bounded codes. Never attach the owner's browser profile or fetch destination bytes. Pairing secrets remain local and are excluded from evidence.

This verifies controlled rule compilation, precedence, lifecycle, redirects/rendering and actual runtime receipt. Production optional-host consent, installed owner/friend browser and desktop visual receipt are still pending. No whole issue14 completion, merge or v1 asset update.

Next download increment prerequisite: explicit issue14 file/contract claim with current Engineer B/coordinator. Main still has no supported downloads monitoring/staging authority. Browser download metadata must never authorize arbitrary desktop paths; require approved staging with native file identity, bounded isolated inspection and partial/error semantics before UI connectivity claims. Do not infer protection from the event inbox.
