# Optional ClamAV engine — issue9

Owner requests selecting a popular maintained GitHub antivirus and implementing it if stronger than the current preview. Selected ClamAV for file-signature coverage; it supplements Sentinel's identity/limits/coordination rather than replacing them. Main preview currently hashes files and detects a single test signature, with full_signature_engine_active=false. No measured malware-corpus comparison was performed. Popularity is not detection quality and no antivirus detects everything.

## Current research (4 October 2026)

GitHub public REST repository metadata and stars sorted searches were inspected. Search results include mail servers, evasion tools and wrappers; filter by actual engine role, not keyword popularity. Public repository view counts were unavailable. These are shortlisted candidates, not a provable global best ranking.

| Project | Stars observed | Role / decision |
| --- | ---: | --- |
| [Cisco-Talos/clamav](https://github.com/Cisco-Talos/clamav) | 7320 | Maintained C-based full signature engine, official Windows portable builds; selected |
| [VirusTotal/yara](https://github.com/VirusTotal/yara) | 9909 | Pattern matcher requiring supplied rules, not a complete maintained AV package |
| [VirusTotal/yara-x](https://github.com/VirusTotal/yara-x) | 1302 | Rust pattern engine; complementary future rules, not substitute signature feed |
| [maliceio/malice](https://github.com/maliceio/malice) | 1862 | Go multi-engine framework, archived, last push2023; rejected for baseline |
| [mirtchovski/clamav](https://github.com/mirtchovski/clamav) | 68 | Go wrapper around libclamav, last push2017; no advantage over native engine |

Official docs: [Windows portable installation and GPG verification](https://docs.clamav.net/manual/Installing.html), [scan options/limits](https://docs.clamav.net/manual/Usage/Scanning.html), [pinned stdin implementation](https://github.com/Cisco-Talos/clamav/blob/clamav-1.5.4/clamscan/manager.c). Windows on-access enforcement is not supplied by ClamOnAcc (Linux-only). ClamAV GPL-2.0 redistribution obligations and third-party licenses need coordinator review; a process boundary is not a legal conclusion. No binaries/databases are committed or redistributed in this PR.

## Native API / GLM contract

`sentinel_scan::clamav::scan_benign_file(selected: &Path, executable: &Path, database: &Path, timeout: Duration, cancelled: impl FnMut() -> bool) -> sentinel_proto::clamav::ClamAvReport`

Trusted native caller only; executable and database are pinned authenticated local configuration, NOT browser/UI arguments. Selected input is explicit harmless native intent; no path endpoint is exposed. Timeout 1ns–120seconds; source nonempty regular non-reparse file <=8MiB. One process-wide admission; Busy while child/pipe threads are active. Open read-only/no-follow, bounded snapshot and before/after basic identity/size checks. No source path sent to engine: only bounded snapshot via stdin. Source_changed suppresses result. Same-size/mtime hostile modification and ancestor races are not solved by basic checks: reviewed stable identity/staging remains required.

Fixed engine args: --database <approved-db>, --no-summary, --stdout, --max-filesize=8M, --max-scansize=16M, --max-files=128, --max-recursion=4, --max-scantime=10000, --alert-exceeds-max=yes, --alert-encrypted=yes, --bytecode=no, -. No shell, arbitrary flags, recursive directory/drive scan, TCP daemon, updater, upload, removal/quarantine or system-service registration.

Generated ClamAvReport/ClamAvState bindings are output-only. JSON examples:

```json
{"state":"no_known_finding","coverage":"partial"}
{"state":"signature_match","coverage":"partial"}
{"state":"inspection_incomplete","coverage":"partial"}
{"state":"timed_out","coverage":"unavailable"}
```

Unavailable includes missing executable/source/invalid native configuration; failed includes missing/corrupt DB, output/error/exit mismatch; cancelled/source_changed/busy remain separate. Exact single stdin record must agree with exit0/1; unknown/multiple/malformed output or signal termination cannot become clean. Limit/encrypted heuristics mean incomplete, not malware. Signature_match is an engine match, not independently proven malware. No raw signature names/output/source contents returned or logged. Always partial on successful evidence; never set existing full_signature_engine_active from this result. UI must bind report to its own native operation/selection and label evaluation/database provenance. This API does not provide subject/session transport authorization.

## Actual evidence and limits

Portable official ClamAV1.5.4 x64 downloaded/extracted in ignored-for-Git-by-scope .local-handoff (untracked; preserve). ZIP SHA256 `0d9e0228b2674137ea1a2853566c98a0278ad52ab2582c3d6dbd75373848c395` matched official HTTPS GitHub asset metadata. Detached signature verified with Talos public key from official documentation: fingerprint `5BADCA2665EF59DCF8A23D8B707F0DB480836771`, GPG GOODSIG/VALIDSIG. Trust source is official HTTPS documentation; local GPG web-of-trust remains undefined. Existing GPG required relative paths/verification-only no-autostart after agent import error; verification itself exited0 before extraction/execution.

Real executable reports ClamAV1.5.4. Read-only adapter tested four harmless samples using THREE CUSTOM HASH SIGNATURES marked Synthetic.Sentinel.TestOnly: control no_known_finding, three challenge files signature_match, all partial. Hash signatures intentionally match exact fixtures; they do not demonstrate Base64/deobfuscation difficulty or malware detection effectiveness. Production official signature databases are NOT downloaded/configured/freshness-verified. Missing DB -> failed/unavailable. Actual controlled timeout and post-launch cancellation test pass. Four ordinary tests + explicit ignored real-engine test pass; focused clippy passes. Run real test only with SENTINEL_TEST_CLAMAV, SENTINEL_TEST_CLAMAV_DB and SENTINEL_TEST_CLAMAV_SAMPLES explicitly set to authenticated engine/synthetic DB/harmless pack, then cargo test -p sentinel-scan --test clamav official_engine_benign_journey_and_failure_states -- --ignored --test-threads=1.

This is a runnable ENGINE ADAPTER increment, not completed antivirus/UI protection. Existing production scan path remains intact/default inactive. Full official database authenticity/freshness, pinned executable revalidation, Windows memory/token/network/process-tree isolation, private temporary-file cleanup after forced termination, authenticated jobs, selected-file authority, UI/runtime integration and actual broader acceptance remain required before hostile input. Deadline starts at process launch; native snapshot opening/read can block on OS I/O. Kill/wait assumes supported child termination; bounded pipe threads retain admission if still active. Child RAII attempts cleanup on unwind, but no arbitrary descendant containment guarantee. No Defender changes, malware/EICAR files, valuable content, E: access or destructive remediation.

Next: coordinator review engine/license/output/parser boundary; integrate through reviewed restricted-worker/native jobs and official authenticated DB setup, then GLM consumes generated evidence with explicit database/coverage/subject states. Do not enable hostile-input capability or claim issue9/S1 complete from synthetic evidence.
