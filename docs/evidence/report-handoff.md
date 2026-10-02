# Preserved report-validation handoff — #9 / #6

2 October 2026. This branch preserves the four unpublished files from the deprecated primary Codex checkout, based on current main. The primary checkout remains unchanged. The initial source transfer is exact; `.local-handoff/SHA256.txt` in the active worktree records the verified snapshot hashes. Do not retire the old branch until this useful work is integrated or explicitly superseded in review.

Files: apps/desktop/ScanJob.ps1, Sentinel.ps1, tests/jobs.ps1, tests/reports.ps1. The change validates report envelope/profile/count/digest/finding fields before preview presentation. This is transitional report logic, not authenticated jobs or a permanent WPF expansion. The single presentation-line handoff is existing Codex work; GLM review is requested before integration.

Actual checks: the supplied report-validation tests pass; desktop process jobs pass (including real harmless file/folder CLI samples); native window smoke passes. The tests use a process-local execution-policy bypass only; no machine policy changes.

Review limitations: the current single-file rule `filesChecked + filesSkipped == 1` rejects a legitimate AccessError report, whose count is represented in accessErrors. State/count/digest consistency is not yet fully enforced. The supplied tests do not cover those paths. This draft is a preservation handoff and must not merge until failure-path validation is completed and tools/verify.ps1 is run on the final tree. #6 authenticated jobs and #9 broader scan/remediation acceptance remain open. No E: access, secrets, malware files or USB policy experiments.
