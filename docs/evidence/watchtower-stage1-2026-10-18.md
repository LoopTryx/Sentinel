# Watchtower stage 1 checkpoint — local hostname evidence

This is the first implementation slice of the owner's four-stage request. Stage 1 is **partial**, not finished website protection. Stages 2–4 have not been implemented in this slice. The owner requested a report after each stage before moving on; the real-feed result below must remain visible in that review.

## Built

- Existing Windows configuration assessment and 30-second Watchtower refresh remain in place. A parallel passive collector reads at most 32 DNS client cache names and 32 established local TCP connections. It does not perform name resolution, reverse lookup, packet capture, TLS handshakes, scans or network changes.
- The existing extension's `inspectMessageLink` and brand/config data are reused. Added configurable hostname structure, long/random label, mixed-script and brand-in-subdomain evidence, category combinations, known-service and user-trusted thresholds, and bounded in-memory first-seen context. No single weak category can flag a name.
- Tiered Safe / Suspicious / Likely Malicious results include reasons. Safe explicitly means no combined hostname indicators, not a safety guarantee. DNS-cache records are never called browser visits. Connection metadata is not falsely attributed to a DNS entry or a website.
- Names, addresses and process names exist in the current local report; no disk history, telemetry, page content, URL paths, credentials or process command lines are saved. First-seen memory holds at most 64 hostname hashes and expires according to config. Edit `apps/demo-runtime/watchtower-config.json` for weights, bonuses, thresholds, known/trusted domains and retention minutes. No retained event log is added. Collection output and response size are bounded.
- Existing authenticated native `wifi.assess` / desktop-only `/wifi` route is reused. A paired browser still cannot request desktop observations. No new caller authority or privileged operation is added.

## Tested

`node --test apps/demo-runtime/watchtower.test.mjs apps/demo-runtime/wifi.test.mjs` passed nine tests: weak-clue controls, mixed scripts, known brands, trusted thresholds, canonicalization/path refusal, bounds, first-seen expiry, and desktop/browser authorization.

UI typecheck, `watchtower-view.test.tsx` and production build passed. Passive collection on the owner's PC reported DNS available (8 accepted names) and connections available (32 bounded records), with blocking=false. Only aggregate availability/counts entered tool output; private destinations and process names were not printed.

## Evaluation: do not hide the false negatives

`node apps/demo-runtime/watchtower-evaluate.mjs` evaluates 100 holdout cases (50 unique hostnames extracted from the OpenPhish public URL feed, 50 legitimate or invented legitimate controls), plus five separate synthetic controls. Only the public feed text was downloaded. No listed destination was visited. Source, selection and date are recorded in `apps/demo-runtime/test/fixtures/watchtower-domains.json`; machine-readable aggregate results are in `watchtower-stage1-evaluation-2026-10-18.json`.

| Holdout | False positives | False negatives | Correct malicious detections |
| --- | ---: | ---: | ---: |
| Before: no website detector | 0 / 50 legitimate | 50 / 50 malicious | 0 / 50 |
| After: hostname rules only | 0 / 50 legitimate | 50 / 50 malicious | 0 / 50 |

Four invented lookalike/combination controls are flagged; the invented legitimate control is not. Those controls are not proof of real phishing detection. Source labels describe malicious **URLs**, often on compromised or hosted domains; a name alone cannot establish which path or page is malicious. This set is small, selected in feed order, and not representative accuracy evidence. Thresholds have not been relaxed or tuned against the held-out public-feed names. There is no demonstrated public-feed detection improvement from this slice.

## Still required in stage 1

- Opt-in reputation, domain age and TLS evidence; external lookup toggles in the config are reserved and **do not enable implemented providers**.
- Browser-visible URL evidence and a reviewed extension-to-desktop transport. Current code deliberately does not infer that a name in the DNS cache was visited.
- Public-suffix-complete registrable-domain analysis and broader homograph coverage. The inherited known-brand and configurable structure heuristics are bounded approximations.
- Expanded, separately held-out evaluation showing useful detection without unacceptable false positives, plus independent review of the privacy changes.

Stage 2 still needs recorded/mock Wi-Fi and local tampering baselines. Stage 3 still needs process/timing behavior and supported byte/NXDOMAIN sources; cache and TCP snapshots cannot establish upload sizes or NXDOMAIN floods. Stage 4 still needs reviewed, explicitly elevated and reversible Windows response operations with installed acceptance. There are currently no Block/Allow/Trust action claims or blocking buttons in this slice.

References: [Microsoft DNS client cache command](https://learn.microsoft.com/en-us/powershell/module/dnsclient/get-dnsclientcache), [OpenPhish public feed](https://github.com/openphish/public_feed), [OpenPhish feed scope/terms](https://openphish.com/phishing_feeds.html).

## Stage 1 opt-in follow-up

Implemented after the initial checkpoint: opt-in OpenPhish feed download, .com/.net RDAP registration age through Verisign, and diagnostic TLS certificate evidence. Enable `externalLookups.enabled` and each selected provider in the editable config, then restart. Defaults remain off. RDAP discloses the domain to its provider; the public feed download sends no visited-domain list. TLS only runs for recently observed browser hostnames, resolves public IPv4 addresses, rejects private/reserved destinations and never sends application content. External work is bounded to one destination per refresh and results expire from memory. Timeout, unsupported TLD, private destination and unchecked states are explicit.

The extension Settings now offers an opt-in hostname-sharing checkbox. Site-access permission is requested visibly on enabling. Only paired localhost receives the hostname, never URL paths/query strings, content or private tabs. Disabling sharing clears the runtime's remembered browser hosts where connected. This uses a separate browser-write-only ingress; browsers still cannot read desktop observations. Full install/browser acceptance is pending.

Fifteen domain/provider/backend tests and 17 existing worker/transport/runtime regressions passed. Mocked tests cover no opt-in/no network, TLS private-address refusal, certificate failures, RDAP/reputation evidence, hostname-only transport, browser authority and expiry. UI typecheck/test/build passed. Providers and browser integration are implemented candidates; no actual private-domain lookup or target TLS connection was enabled on the owner's device. The earlier 'reserved/unimplemented provider' and missing browser bridge bullets above describe the initial checkpoint and are superseded by this follow-up. Broad public-suffix/homograph coverage, external installed acceptance and independent privacy/security review remain limitations. The 100-case default-local evaluation is unchanged; do not present mock reputation results as improved held-out accuracy.
