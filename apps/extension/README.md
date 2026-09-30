# Chrome extension harness

This unpacked Manifest V3 extension tests the browser boundary with one synthetic domain. It blocks top-level navigation to `blocked.cybershield.invalid` using a packaged Chrome DNR rule. No real threat feed, content script, native host, download scanning, or vault access is enabled. The popup reports that narrow scope.

From the repository root, run `node apps/extension/scripts/build.mjs`. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `apps/extension/dist`. The only rule is a synthetic fixture; it is not a general Web Shield. Unload the extension after the harness exercise if you no longer need it.

Next stages: local URL verdict protocol; native host with exact extension ID allowlist and bounded framing; offline interstitial and expiring exceptions; completed-download handoff; then live browser restart, hostile-message, and rule-capacity checks.
