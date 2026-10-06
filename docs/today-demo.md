# Connected school demo — 6 October 2026

This candidate preserves GLM's glass console and adds a separate, explicitly labeled demo runtime. It is not completion of the expanded S1 security product or reviewed native-messaging/vault implementation. ClamAV 1.5.4 is the selected demo engine; the temporary Defender provider was removed at the owner's clarification.

## Launch

1. Run `pnpm --filter @sentinel/ui build` and `node apps/extension/scripts/build.mjs`.
2. Build `apps/desktop/build-console.ps1 -WebView2SdkPath <official SDK folder>`.
3. Run `tools/launch-demo.ps1`. It opens the real desktop window, starts an ephemeral loopback runtime and stops its owned runtime when the window closes.
4. Load or reload `apps/extension/dist` as an unpacked Chrome extension. In its Connection controls, copy its extension ID.
5. In desktop Logs & Activity, enter that exact ID and Create companion pairing. Enter the displayed port/key in extension Connection controls, then Pair local demo. The browser asks for optional localhost access. Approve only if you intend this local connection. No other website access is requested.

Pairing expires when the runtime exits or is paired again. Browser storage is session-only. Config/bootstrap files and build outputs are ignored by Git. The bearer bridge is suitable for these invented records, not a reviewed authorization design for valuable credentials. It grants dummy account operations and bounded reason-code events; browser clients cannot select files or read desktop scan details.

## Five-minute route

- Desktop Passwords: four fictional .test accounts. Orbit Mail has a common weak password; School Portal and Arcade share a predictable password. Health and reuse counts are computed from actual in-memory records. Unlock demo vault, inspect recommendations, then Generate & save demo replacement. The audit changes in both clients. Reveals are explicit and clear on locking/state change.
- Desktop Scan: choose `apps/demo-runtime/samples/02-marker.txt`. Reads/hash evidence and harmless marker detection are real. ClamAV receives the exact read snapshot through stdin only after its SHA-256 matches the checked-in harmless sample allowlist. Choose the samples folder to show three real files and two synthetic markers. Real ClamAV matches are separately labeled; they demonstrate custom signatures, not malware efficacy. The installed executable's SHA-256 is pinned. Official main/daily databases downloaded and passed FreshClam checks; when present they load alongside the demo HDB. Unknown bytes do not enter ClamAV pending hostile-parser review.
- Extension Link X-Ray: inspect `http://bit.ly/prize-payment`. Shows HTTP, short-link and reward/payment clues without fetching the destination. Desktop activity receives only reason codes.
- Extension Scam clues: use `URGENT: send money to claim your prize at http://example.test`. Shows local reasons and records redacted activity. This is on-demand; WhatsApp monitoring is not implemented here.
- Extension Passwords: same invented account state. Locking or replacing through either client affects the other. Close desktop to show disconnected state rather than a made-up protection claim.

## Contracts and limits

Rust source `crates/sentinel-proto/src/demo.rs` generates the DemoState/Account/Event/Scan/File/Finding TypeScript DTOs. `apps/ui/src/demo-bridge.ts` exposes `demoCall(method,data)` and `useDemoState()`. Native calls are accepted only from the bundled exact console URL, never a foreign page.

Desktop methods: `state`, `lock`, `unlock`, `reveal/rotate {id}`, `pair {extensionId}`, `scan.select {kind: file|folder}`, `cancel`. Selection is through the native picker. Extension transport accepts only its own popup sender and `state`, `lock`, `unlock`, `reveal/rotate {id}`, `event {risk,codes}`. Event examples: `{risk:"suspicious",codes:["http","shortened"]}`. Responses: shared redacted DemoState, `{ok:true}`, explicit `{password,mode:"synthetic_demo"}`, or fixed `{error}`. No raw URL/message/password input is accepted by event ingestion.

Scans: 8 MiB/file, 64 files, 256 traversal entries, four levels, cooperative 45 seconds. No percentage is fabricated. Symlinks/oversized files are skipped; skipped/error/provider-unsupported items make completion partial. File identity/size/mtime checks detect changes during byte reads. This is not hostile-parser isolation. ClamAV runs without a shell or remediation flags, with bytecode and document/archive/image/executable parsers disabled. Provider wait is capped at 15 seconds and 32 KiB output; cancellation kills and reaps this owned child. Exit 0 means no detection, exit 1 is matched signature (known demo name is labeled synthetic; other matches are signature alerts), exit 2/other is engine error. E:, UNC and device-namespace selections are refused.

No actual website password changes, credential export/import, encrypted persistent vault, autofill, cloud explanations, downloaded-file monitoring or automatic navigation classification are implemented in this candidate. The existing test-only blocked.sentinel.invalid rule remains test-only. Defender is not disabled, no malware/EICAR is introduced, and CRYPTIC E: is not accessed.

## Observed verification

- Real loopback runtime and extension-transport tests: computed audits, edits, redacted events, rejected website/content-script callers, scan authority separation, key revocation and protected namespace rejection.
- UI component test: weak/reuse recommendations render and a revealed invented password disappears on lock.
- Initial Defender probe on a harmless file succeeded; that adapter was replaced, not retained as an automatic fallback. Real ClamAV probes produced no-detection on the clean control and synthetic-match on both demo fixtures. Official FreshClam main/daily database tests passed.
- GLM glass console build and native smoke: passed outside the execution sandbox. Native launch now records `backend=demo_runtime` only after an authenticated state probe succeeds. Actual desktop screenshot showed a selected-file result and connected scan controls. Sandbox launch timed out and is not counted as success.
- Installed-browser pairing and the full desktop route still require actual supported-browser evidence; a Node transport test is not Chrome execution evidence.

Coordinator/GLM: review mixed presentation changes and integrate through existing gates. Do not close whole S1 issues on this demo prerequisite alone.
