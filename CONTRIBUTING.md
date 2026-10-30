# Contributing

Sentinel combines Rust security components, a Windows C# host, React/TypeScript interfaces and a Chrome extension. Read [the architecture](docs/architecture.md), [security policy](SECURITY.md), and [collaboration rules](docs/AI-COLLABORATION.md) before changing security-sensitive behavior.

1. Open or claim an issue with scope, affected files and acceptance checks.
2. Create a short-lived branch from current main. Preserve other contributors' uncommitted work.
3. Keep contracts and validation at process boundaries. Preserve unavailable, partial and failed states.
4. Add meaningful behavior/regression tests, run the applicable checks and describe untested journeys.
5. Open a pull request with the problem, resulting behavior and actual verification evidence. Obtain independent review for authentication, vault, scanner, quarantine and device-policy changes.

## Development

```powershell
pnpm install --frozen-lockfile
pnpm --filter @sentinel/ui build
node apps/extension/scripts/build.mjs
./tools/verify.ps1
```

The complete verifier requires the pinned Rust toolchain and a configured Windows development environment. Native packaging additionally requires the official WebView2 SDK and the scanner/model assets documented in [release building](docs/releases/building.md).

Do not commit credentials, real messages, vaults, conversations, runtime pairing configuration, browser profiles, generated bundles, build caches or binaries. Release artifacts belong on GitHub Releases. Synthetic fixtures must be identified as synthetic.

Keep Microsoft Defender enabled. Never test USB/HID blocking on a daily-use computer; use an owned, recoverable test machine. Do not rewrite published history or force-push shared branches.
