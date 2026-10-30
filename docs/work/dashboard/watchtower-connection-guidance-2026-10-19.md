# Watchtower connection guidance — 2026-10-19

User goal: replace the wall of Safe domains with understandable Wi-Fi guidance.

Implemented in WatchtowerView.tsx and watchtower.css: connection-first summary; open/WEP link warning; contextual Windows Public-profile instructions; existing session topology reasons surfaced with legitimate-change caveats; suspicious domain/connection evidence only in attention section. Routine domain observations remain collapsed and say No hostname warning, not Safe. Acknowledge action changes warning preference only. Existing trusted exceptions remain visible/removable in collapsed management after review caught this compatibility issue. No new trust creation, unavailable Block button, packet capture, network mutation or cloud transmission.

Verification: three focused view regressions PASS; ten existing Wi-Fi/topology/auth tests PASS outside sandbox loopback restriction; UI production build PASS; compact/wide simulated open-WiFi render checks PASS (no overflow or JS errors). Full UI suite result is recorded in artifacts/watchtower-ui-tests.log. Actual local collector returned only bounded categories: Wi-Fi/WPA2/Public, configured gateway/DNS, no configured proxy, VPN unknown. Simulated open Wi-Fi is presentation evidence only, not a live insecure-network trial.

Installed UI hash matches built index; backup receipt artifacts/watchtower-installed.json. Sentinel process/window confirmed open. No native executable or USB policy changed in this update. Existing limitations remain: no Wi-Fi attack prevention, evil-twin verification or firewall blocking. Background observations run only while the tab is active via its existing refresh lifecycle.

Final full UI suite: 34 files / 93 tests PASS (artifacts/watchtower-ui-tests-native.log); initial sandbox run had temporary-cache ENOENT errors. Final live observations and installed hash are recorded above.
