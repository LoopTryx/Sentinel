# Sentinel console — Tauri 2 presentation shell

Native window over the built `apps/ui` bundle (GLM, issue #10 / S1 showcase).
This is presentation only: no privileged logic, no backend authority, no live
protection. Fixture mode remains visibly labeled inside the UI itself.

Intentionally a **standalone crate** (own lockfile, detached from the root
Cargo workspace) so the Tauri/WebView2 dependency tree does not slow CI's
`cargo test --workspace`. Coordinator decisions recorded in PR #31: if CI
coverage for this shell is wanted later, gate it as a separate job.

## Run (Windows)

```powershell
pnpm -C apps/ui build            # build the console UI bundle first
$env:CARGO_TARGET_DIR = 'C:\cs-target-sentinel'
cargo run --manifest-path apps/desktop-tauri/Cargo.toml
```

- `CARGO_TARGET_DIR` outside the repo is required: the space in the
  `D:\stai- cyber shield` path breaks resource embedding during builds.
- Requires WebView2 Runtime (preinstalled on Windows 11) and the GNU Rust
  toolchain on machines without Visual Studio Build Tools.
- Pass-through of the fixture scenario rehearsal states:
  set environment variable `SENTINEL_SCENARIO` is not wired — instead the UI
  reads `?scenario=`; the shell loads the bundle root, so switch scenarios
  with the in-app Fixture scenarios buttons.

## Boundaries

- No IPC commands, no URL fetching, no filesystem or policy access — the
  WebView renders the local bundle only.
- Real backend connectivity lands through Codex's contracts/adapters
  (LOGIC-01); this shell does not claim live protection.
