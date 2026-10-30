# Watchtower response checkpoint — 18 October 2026

Implemented desktop-only Allow once (five-minute acknowledgement), explicit native confirmation for Always trust, durable bounded trusted-domain storage and Remove trust. Trust raises warning thresholds; it does not declare a destination safe. Browser credentials cannot invoke preference changes or collect desktop observations. Writes are serialized and atomic, and a failed save restores the prior in-memory trust set. No browsing history is persisted by this preference store.

Windows Firewall / hosts / DNS blocking and undo are NOT implemented. The UI disables Block and explicitly reports that no rules were created. Allow once acknowledges a warning; it is not a firewall bypass. Native confirmation is compiled, but interactive installed acceptance remains pending.

## Overall delivery status

- Stage 1: bounded hostname combinations, passive DNS/TCP metadata, opt-in browser hostname/field-presence ingress and default-off reputation/RDAP/TLS providers implemented. Provider mocks tested; live provider/browser acceptance pending. Public-suffix handling is approximate.
- Stage 2: passive session Wi-Fi/topology/tampering comparisons implemented and fixture tested. These are indicators, not proof of an evil twin. History is bounded session memory, not an approved persistent baseline.
- Stage 3: sampled distinct connection timing and new random-hostname bursts implemented and fixture tested. Per-app upload and NXDOMAIN query-rate detection remain unavailable.
- Stage 4: acknowledgement and trust preferences implemented. Actual elevated blocking, rule inventory and undo remain unfinished.

## Validation and accuracy

Focused backend tests: 27 passed; preference persistence/expiry/validation regression also rerun after concurrency hardening. UI typecheck, Watchtower view test and production build passed before the final action assertion. Desktop host compiled successfully. Full tools/verify.ps1 passed at d2556a1; later additions use affected backend, extension and UI checks, not a repeated full Rust gate.

The frozen holdout has 50 public-feed phishing hostname labels and 50 legitimate controls: both baseline and local-only detector produced 0 false positives and 50 false negatives. No public-data accuracy improvement is demonstrated. Five separate synthetic controls passed (four true positives, one true negative). The same reputation feed is not reused as proof of benchmark accuracy. See stage1 JSON for exact counts and provenance.

Independent privacy/authority review, installed acceptance and the remaining implementations are required before claiming complete network protection or release readiness. No privileged machine policy was activated during development.
