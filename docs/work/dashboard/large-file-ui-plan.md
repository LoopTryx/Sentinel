# Large-file scanning and console polish

Owner: Engineer A, existing dirty scan integration branch. Preserve peer UI, USB policy and existing authorization. User explicitly requests immediate implementation.

Design: blue liquid glass, existing display/body fonts; navy #0a1021, slate #193553, ice #d6efff, cyan #63c7ef, white #edf3ff. Main scan actions always visible; distinct full-width progress surface with real counters/current file/elapsed, indeterminate traversal rather than a fake percentage. Retain native-confirmed legacy manual quarantine as an open section. Fix button layout at the shared wrapper boundary rather than layering more arbitrary spacing. Carry shared heading/control polish through Device Overview and scan/AI surfaces.

Implementation: read-only retained-file mapping + bounded streaming SHA-256; 1 GiB top-level scan cap within ClamAV's documented <2 GiB individual-file ceiling. Preserve expanded-content/time bounds. Encrypted-vault limit 64 MiB, same authenticated format, exact-subject checks and restore authority. Legacy selected-inspection contracts retain their independent 8 MiB bound. Show larger/skipped/incomplete content truthfully.

Verification: old-limit regressions fail first; harmless >256 MiB full-file scan, >8 MiB actual vault roundtrip and upper bound tests; native official engine large-file qualification; full verifier; independent authority review; actual installed DOM and compact/wide visual checks.

Defender comparison: no superiority claim or disabled Defender. Record a feature/evidence gap matrix. Kernel pre-execution interception, tamper-resistant service/driver, behavioral ransomware blocking, cloud intelligence and offline recovery require separate architecture/signing/lab qualification; do not label a UI toggle as implementation. Improvements must be benchmarked against detection, false positives, containment, latency and CPU/RAM, without malware on this daily-use laptop.
