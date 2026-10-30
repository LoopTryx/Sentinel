<div align="center">

# Sentinel

**A local-first Windows security companion.**

File inspection, browser awareness, encrypted passwords and local AI in one desktop console.

[Download v1.0.0](https://github.com/LoopTryx/Sentinel/releases/tag/v1.0.0) · [Changelog](CHANGELOG.md) · [Architecture](docs/architecture.md) · [Report a problem](https://github.com/LoopTryx/Sentinel/issues)

Windows 10 / 11 x64 · Chrome companion · Rust · C# / WPF · React / TypeScript

</div>

![Sentinel console preview](docs/evidence/sentinel-ui-integration.png)

*Historical interface preview. This image is not evidence of current protection or hardware acceptance.*

## Capabilities

| Area | Implemented behavior | Boundary |
|---|---|---|
| File inspection | Rust inspection core, ClamAV signature integration, YARA-X rules, SHA-256 matching, static indicators and entropy analysis | Different scan paths use different layers; partial/error states remain visible |
| Native scanning | Persistent signature worker, monitored downloads, manual scan modes and cancellation | No guarantee that every malicious file will be detected or blocked before execution |
| Passwords | Encrypted local vault, metadata browsing, native Windows Hello approvals, account management and generator | Real browser/Hello behavior must be checked on the target machine |
| Browser companion | Connected overview, supported autofill/save flows, opted-in link and message awareness | Chrome permissions and supported site layouts are required |
| SentinelAI | Local model inference, bounded conversational context and encrypted local chat history | Advice can be wrong; online Think mode uses NVIDIA NIM with consent/configuration |
| Device overview | CPU, system RAM, aggregate Chrome working-set memory and drive capacity | Chrome memory is aggregate process usage, not exact per-tab RAM |
| USB workspace | Device observations, file inspection and separately gated policy/driver experiments | Not complete BadUSB protection; experimental enforcement is not a daily-use safety guarantee |
| Quarantine | Encrypted storage, inspected-file identity checks and recovery bookkeeping | Heuristic suspicion alone does not authorize automatic containment |

## Install

1. Download **Sentinel-v1.0.0-Setup.exe** from [Releases](https://github.com/LoopTryx/Sentinel/releases/tag/v1.0.0).
2. Compare its SHA-256 with the release's `SHA256SUMS.txt`.
3. Run Setup. It checks the platform and guides prerequisite setup; internet access may be needed for WebView2.
4. Follow the Chrome companion instructions. Chrome may require a one-time user approval; the installer cannot silently bypass that security boundary.
5. Open Sentinel. Enable only the browser features and permissions you intend to use.

Keep Microsoft Defender enabled. The app does not guarantee detection, safe browsing or immunity from USB attacks. The installer is not claimed to be publisher-code-signed. Existing account and chat data belongs to the user and is not included in release payloads.

## Privacy and AI

Supported local analysis runs on the computer. Password contents and chat history use separate encrypted local stores. Local AI uses bundled quantized models through llama.cpp. Optional online Think mode uses NVIDIA NIM and requires provider configuration and the applicable consent flow. Do not interpret “local-first” as a promise that every optional feature is offline.

## Build and test

Install Node.js, the repository's pnpm version and the pinned Rust toolchain. Native Windows builds also need .NET Framework tools, the official WebView2 SDK and prepared third-party engine/model assets.

```powershell
pnpm install --frozen-lockfile
pnpm --filter @sentinel/ui build
node apps/extension/scripts/build.mjs
./tools/verify.ps1
```

See [release building](docs/releases/building.md) for native packaging and asset requirements. The desktop currently ships as **WPF + WebView2**, not the earlier planned Tauri shell. Generated bundles and large binaries are not committed to source.

## Repository map

| Path | Purpose |
|---|---|
| `apps/ui` | React console and shared companion vault UI |
| `apps/desktop` | Native Windows host, connector, approvals and installer |
| `apps/extension` | Chrome Manifest V3 companion |
| `apps/demo-runtime` | Local backend and AI orchestration; legacy directory name |
| `crates` | Rust scanning, vault, USB, contracts and runtime components |
| `packages/contracts` | Generated cross-component contracts |
| `tools` | Build, test, packaging and gated qualification tooling |
| `docs` | Architecture, engineering history and capability evidence |

## Releases and contribution

The early v1/v2/v3 previews are now numbered **v0.1.0 / v0.2.0 / v0.3.0**. The latest consolidated application is **v1.0.0**. Original commits and authors are preserved; see [version migration](docs/releases/version-migration.md) for historical artifact limitations.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before development and [SECURITY.md](SECURITY.md) before security testing. Third-party engines, models, fonts and assets retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).
