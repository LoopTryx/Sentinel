# Preserved report-validation handoff — #9 / #6

2 October 2026. This branch preserves the four unpublished files from the deprecated primary Codex checkout, based on current main. The primary checkout remains unchanged. The initial source transfer is exact; `.local-handoff/SHA256.txt` in the active worktree records the verified snapshot hashes. Do not retire the old branch until this useful work is integrated or explicitly superseded in review.

Files: apps/desktop/ScanJob.ps1, Sentinel.ps1, tests/jobs.ps1, tests/reports.ps1. The change validates report envelope/profile/count/digest/finding fields before preview presentation. This is transitional report logic, not authenticated jobs or a permanent WPF expansion. The single presentation-line handoff is existing Codex work; GLM review is requested before integration.

Actual checks: the supplied report-validation tests pass; desktop process jobs pass (including real harmless file/folder CLI samples); native window smoke passes. The tests use a process-local execution-policy bypass only; no machine policy changes.

The first commit preserves the original work. Follow-up tests reproduced rejection of a legitimate AccessError report, whose count is represented in accessErrors. The correction validates checked, error and skipped file states separately, requires a digest only for checked states, and rejects a claimed active signature engine in this preview. Tests also reject contradictory state/count/digest combinations. Report tests, native jobs/smoke and tools/verify.ps1 pass on the corrected tree.

This remains a narrow transitional preview increment. It does not authenticate the subprocess, bind reports to durable job/subject identities, implement scan profiles or validate every possible directory aggregate. Peer review and those broader #6/#9 gates remain open. No E: access, secrets, malware files or USB policy experiments.
# 2026-10-03 aggregate-validation correction

The coordinator's cancellation/completion reproduction failed the new negative test before implementation: malformed directory output was accepted. Validation now rejects complete reports with cancellation, limit, skipped, access-error or engine-failure states. It enforces visited <= entries and visited <= checked + skipped + errors, while allowing root/entry-level errors and skips up to entries + 1. Decimal arithmetic avoids Int64 sum overflow; the current producer has no engine-failure directory path, so nonzero engine failures are rejected. These bounds follow sentinel-scan's actual producer rather than assuming all skips/errors are visited files.

Seven negative aggregate cases and six positive partial cases pass, including root access failure, unsupported root, cancellation and limit states. Native jobs and smoke pass. The initial jobs invocation failed on a generated PowerShell script under the default execution policy; rerunning the test runner with process-scoped `-ExecutionPolicy Bypass` passed, without changing machine policy. No presentation styling was edited. PR remains draft for GLM review and coordinator integration.

Full tools/verify.ps1 passed on 2026-10-03 after the aggregate correction.
