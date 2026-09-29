# ADR 0002: Dependency and provider review ledger

Status: pending evidence, 2026-09-29. Source: v3 master plan sections 2, 3, 5, 6, and 8/T00.

No production dependencies or network providers have been selected or installed. T00 must record exact versions, licenses, distribution obligations, authentication, data disclosure, offline behavior, and support status before T01 pins a working toolchain. In particular, a separate ClamAV process does not settle GPLv2 redistribution duties, and an update hash is trusted only after manifest authentication.

| Candidate | Intended role | Decision and evidence needed |
| --- | --- | --- |
| Rust and Cargo | Broker, agent, workers, contracts | Pin installed working stable toolchain after build probe; currently absent from PATH |
| Tauri 2, React, TypeScript, WXT | Desktop and extension | Check exact versions, licenses, Windows build, browser registration, accessibility |
| SQLite, YARA-X | Local storage and rules | Check exact versions, licenses, parser limits, build and fixture behavior |
| ClamAV | Optional full-signature process | Measure whole process-tree memory and review GPLv2 redistribution before binaries are shared |
| Threat-intel feeds | Explicit opt-in lookup/update | Record provider auth, terms, expiry, provenance, transmitted data, and offline fallback |

Until review completes, the default provider policy is no product network requests and no unsupported capability claim.
