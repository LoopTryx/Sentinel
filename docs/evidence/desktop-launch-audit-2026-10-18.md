# Desktop launch audit — 18 October 2026, Asia/Muscat (UTC+04)

Scope: commands available in this chat, repository history and this workspace's build/launch logs after 13:00. This is not a claim to audit commands from other chats or unrelated applications.

## Findings

The recent normal launch recorded initialization_timeout at 21:11:20. A second native smoke launch from the restricted execution environment reproduced the timeout. Both lacked evidence of a loaded Console; a responding Sentinel.Glass process and nonzero window handle were insufficient verification.

Without changing the executable or UI assets, running the same native smoke through the unrestricted execution environment succeeded: navigation=True, glass=true, heading=Console, backend=demo_runtime and inspection bridge returned. The subsequent ordinary launch also recorded navigation=True / heading=Console / backend=demo_runtime at 21:18:55. Its own reopen signal was then sent from the unrestricted environment. This comparison points to the sandboxed launch environment, rather than mascot assets, as the cause of these initialization failures. Direct visual confirmation by the owner remains separate.

## Commands reviewed by purpose

- 13:00–14:00: Watchtower backend tests, UI typecheck/Vite build, native build and commits. Builds passed. Native preferences did not change WebView creation or navigation.
- 14:02 onward: Start-Process launch-demo.ps1 and process/event checks. These were initially run inside the restricted tool environment. They could leave a process alive without a usable WebView. Reporting success based only on Responding was incorrect.
- 17:45–17:52: extension overlay source changes, Node tests, extension build/parity checks and ZIP packaging. These target apps/extension, not desktop startup. Extension build deletes/recreates only its dist directory.
- 19:54: message-detector/config/test changes and extension packaging. Full extension tests passed; no desktop launcher changes.
- 20:43: mascot additions, UI typecheck and production build. An initial root-directory tsc/vite command failed because those binaries live under apps/ui; rerunning there succeeded. No source was deleted by that failed command.
- 20:51 onward: repeated Start-Process and SentinelDesktopOpen signals in the restricted environment; process checks did not establish that the UI had loaded.
- 21:08–21:11: removed focus-loss auto-hide while preserving secret clearing; native build and tray lifecycle smoke passed. That lifecycle smoke checked hide/reopen state, not WebView readiness. It did not prove the Console loaded.
- Later diagnosis: read readiness evidence, inspected only Sentinel-owned process metadata, reproduced the native startup timeout, then ran native smoke and normal launch outside the sandbox. Terminated only the path-verified failed Sentinel process, not unrelated processes. No Defender, USB/HID policy, E: files, or installed-app files were modified.

## Launch verification for future runs

Launch tools/launch-demo.ps1 outside the restricted execution sandbox using the tool's reviewed escalation mechanism. Keep the helper hidden and the app window normal. Verify fresh apps/desktop/console-build/glass-smoke.txt content and timestamp, requiring navigation=True, heading=Console and backend=demo_runtime. Do not treat process existence, an empty launcher error log, or the tray lifecycle result alone as success. Use the app's Local\SentinelDesktopOpen signal from the same execution environment to reopen an existing instance. Native smoke uses -Smoke and closes after checking; omit it for the user's normal visible app.
