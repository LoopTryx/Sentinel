# Account layout polish — 13 October 2026

Owned candidate branch: codex/engineer-a/desktop-v2-20261013.

Add-login control moved into the All accounts header with an accessible plus icon. Password health toggle uses the existing shield-check SVG in a circular button. Paired account panels stretch to the taller panel and stack below 900 CSS pixels. Navigation and ordinary action controls use 6px corners. Installed WebView defaults to 90% zoom.

Verification: UI suite 33/33 passed (artifacts/accounts-layout-tests.log); TypeScript/Vite build passed (artifacts/accounts-layout-build.log); WebView desktop compilation passed. Package: artifacts/Sentinel-Demo-20261013-132142. Test confirms the header plus opens the existing metadata-only protected add operation. Existing password approval and secret-clearing tests still pass.

Visual appearance and actual physical dragging remain owner acceptance checks. This candidate includes the earlier uncommitted drag and border follow-up. Native IPC changes still require independent review before main integration. NativeConsole.cs remains preserved and untracked.
