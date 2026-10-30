# Automatic observations and layout handoff

The owner requested automatic Watchtower/USB observations, compact sidebar
spacing, and the newest Engineer B UI. The desktop runtime now starts bounded
collectors automatically and keeps them active while the window is in the tray.
USB collection repeats fifteen seconds after completion; Wi-Fi repeats thirty
seconds after completion. Collection never overlaps for the same monitor.
Authenticated desktop routes return cached canonical snapshots; paired browser
callers remain forbidden from collecting raw device or network observations.
Errors clear the cached report and produce unavailable rather than a false
empty/safe result. Closing the runtime stops future collections and discards
late results. No policy changes, HID blocking, traffic capture or automatic
file scanning were introduced.

Both views read automatically on entry and refresh while mounted. Reports stay
in place during refresh to prevent scroll jumps, but are cleared on failure.
Sidebar navigation has its own narrow scroll area and contained overscroll;
the brand and footer stay outside it. Section gaps and account-card stretching
were reduced. Main/content minimum heights allow scrolling inside the window.

Engineer B source inspected: issue-11-glm-pages head 7f403ea, layout commit
62cdd63. Its compatible ScanView, QuarantineView and glm-pages.css were brought
into A's candidate. Its synthetic message/alert Watchtower was not substituted
for the current real Wi-Fi assessment. The extension-theme tip c5672e3 is already
included in this candidate; no newer extension UI delta was found.

Evidence: full local verifier passed; 28 UI tests/build passed; five focused
monitor/privacy tests passed; extension dist parity passed. Updated per-user
Sentinel installation launched and returned a partial USB snapshot with 38
groups and passive Wi-Fi coverage. Automatic-refresh timestamps are checked
separately against the installed runtime.

Installed visual/sidebar acceptance remains unverified. Chrome is not exposed
to this session's browser controls even after the owner opened/reloaded it;
the popup cannot be claimed visibly shown. Review/integration remains pending.
