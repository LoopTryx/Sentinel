# Building a Windows release

Release builds require Windows x64, the pinned Rust toolchain, Node.js, pnpm, .NET Framework build tools and the official WebView2 SDK. The repository pins the toolchain and dependency lockfiles. Large third-party models and scanning databases are distributed as release assets rather than Git source.

1. Run `pnpm install --frozen-lockfile`, the UI build, extension build and `tools/verify.ps1`.
2. Prepare licensed ClamAV runtime files and signature databases and the pinned llama.cpp/model assets. Preserve their notices and verify their hashes. See `tools/package-demo.ps1` for the explicit asset allowlist.
3. Run `apps/desktop/build-console.ps1` with `-WebView2SdkPath`, `-ClamAvDirectory` and `-DefinitionsDirectory` when the assets are outside the documented defaults. Build the native host against the manifest of the exact engine shipped in its payload.
4. Stage the inspection engine using `tools/stage-inspection-engine.ps1`; build the native connector and approval helpers required by the package allowlist.
5. Run `tools/package-demo.ps1 -Version v1.0.0` with the Node.js license path and prepared native directory. The package must contain no user state.
6. Run `tools/build-v2-release.ps1 -PackagePath <stage> -Version v1.0.0 -OutputDirectory <new-output>`; the historical script filename is retained for compatibility. Current builds produce one appended-payload setup executable.
7. Verify the installer with `--verify-only`, audit every payload entry against its manifest, run native/UI checks and create SHA256SUMS.txt for the final assets.
8. Publish a draft release from the exact reviewed commit, upload verified assets, then publish. Never substitute a renamed old installer for a newly versioned build.

Chrome may require a one-time user approval to enable the companion. Setup cannot silently bypass browser extension security on ordinary unmanaged Chrome installations.

Historical v4/v5 labels are documented local milestones, not independently reproducible releases. See [version migration](version-migration.md).
