# URL/scam follow-up — 4 October 2026

Related issue #39. Branch codex/issue-39-url-scam-clues is based on extension candidate PR40 (91d0fb0). Codex owns only local-checks.js/test and this handoff; no GLM styling or permissions changed.

Owner reported a missed HTTP warning. Actual Windows Chrome inspection with Computer Use found the installed unpacked package in the e875 checkout's apps/extension/dist. Entering `http://school-login.example.com@192.0.2.10:8080/verify` and clicking Inspect URL visibly produced HTTP, embedded-credentials, IP and nondefault-port warnings. This report could not be reproduced for the manual input flow. Automatic browsing classification is not implemented. Entering an invented urgent password/payment/prize message and clicking Explain clues produced all five existing message clues. No real phishing website or content was visited.

Two additional assertions failed before implementation: HTTPS shortener-host explanation and combined reward/payment path wording. They now pass. Exact-host matching handles a terminal DNS dot and rejects lookalike suffix matching. One decode pass finds percent-encoded wording; query/fragment contents are excluded. Ordinary HTTPS/login and isolated reward wording remain unknown. Output never copies matched path/query text. This is a small heuristic list, not comprehensive shortener coverage or phishing reputation.

Three new tests (six local-check tests total) and full tools/verify.ps1 pass, including 38 extension tests, recovered UI checks/build, Rust formatting/lint/workspace tests and generated parity. No new dependencies, package versions, permissions, URL fetching, storage or background scanning.

For the owner test session only, the tested generated local-checks.js was copied into the already-loaded e875 dist module (source branch untouched; prior generated module backed up in db54 .local-handoff/extension-local-checks-before.js). Chrome's existing extension reload was initiated. Owner stopped Computer Use with physical Escape before completion; last observed manager state was Reloading/Off. Updated installed browser behavior is NOT verified and must not be claimed. No further desktop control is performed by this scheduled publication. That dist output can be regenerated from source; coordinator must include this reviewed follow-up to retain the new clues.

The dashboard clips at the observed narrow window width. This is GLM presentation-owned and should be checked under existing issue #11; no CSS fix here. A click aimed at Details opened the removal prompt; Escape dismissed it and no removal was confirmed. Subsequent accessibility Details navigation verified the source path. Screenshot evidence is local to this chat's visualization folder, extension-http-scam-test.png.

Next: peer review/integrate with PR40, GLM responsive presentation fix, then owner-authorized extension reload and actual updated-clue verification. The native scan adapter and real S1 rehearsals remain separate work.
