# Sentinel native desktop preview

## GLM glass console (owner-requested primary presentation)

The existing GLM React/Y2K console can run in its own desktop window, preserving its navigation, components and typography. `GlassConsole.cs` replaces the Windows title bar with a narrow native draggable header, accessible minimize/maximize/restore/close buttons and resize borders. Double-clicking the header toggles maximize. Windows 11 Acrylic is requested where supported; other systems keep the navy fallback. The React glass treatment is opt-in (`?desktop=glass`), with reduced-transparency CSS support. Regular browser presentation remains unchanged.

This preserves the original React UI using WebView2; it is not a rewrite into native WPF controls. WPF owns the window frame. The older WPF file-scanning preview below is preserved separately. The console still has no native agent/vault bridge, and its unavailable/partial/scenario labels remain authoritative.

Build the UI with `pnpm --filter @sentinel/ui build`, then build the window using an already acquired official Microsoft WebView2 SDK (tested with 1.0.4258.31):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File apps/desktop/build-console.ps1 -WebView2SdkPath <sdk-directory>
.\apps\desktop\console-build\Sentinel.Glass.exe
```

The installed WebView2 runtime is required. Build output and its dedicated preview profile stay ignored. Assets load directly from `apps/ui/dist` through the reserved `sentinel.example` virtual host; no development server or external site is required. Foreign requests/windows and permission requests are rejected; native host objects and web messages are disabled. The presentation flag grants no native capability.

Run `apps/desktop/tests/glass-console.ps1` after building. This smoke check requires a visible window and a desktop session with permission to start WebView2; the filesystem/process sandbox can prevent browser initialization. It uses a separate smoke profile, checks actual local navigation, React Console rendering, the glass flag, custom frame and backend-unavailable status, then closes. Startup has a 30-second deadline. The check does not verify installed protection, authenticated connectivity or every window interaction. Actual custom minimize, restore, maximize/double-click and close were observed on the owner's desktop on 5 October 2026. Software rendering is used for the WPF frame to keep its controls visible over Acrylic; the web content retains its own renderer.

On Windows, from the repository root:

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\apps\desktop\Sentinel.ps1
```

This opens a native Windows window. Its Overview shows fixture status and explicitly says that no protection service is active. The Files page can select a file for the existing bounded, read-only CLI scan. Build the CLI first with `cargo build -p sentinel-cli`; the UI reports an unavailable scanner if the executable is missing. The CLI result is labeled partial coverage, even when it finds no known finding. Other pages show unavailable states pending their implementation.

Run the native window smoke check with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\apps\desktop\tests\smoke.ps1
```

The smoke check creates an actual Windows window handle, checks the Sentinel title and fixture coverage label, then closes the window. It does not test protection or system policy.

## Asynchronous selected scans

The Files page now supports selecting a file or a folder. A dedicated local CLI process runs outside the WPF dispatcher; navigation remains available. An indeterminate activity bar and elapsed time show that work is running, without inventing percentage progress. One scan runs at a time.

Cancel terminates this preview CLI process; a 120-second deadline also stops hung processes. Cancelled/timed-out/failed jobs have incomplete coverage and no completed verdict. Closing the window requests termination of the owned scanner. Diagnostics are not copied into the UI, because they may contain selected paths. Results are kept only in the current window.

These are local preview process jobs, not persisted authenticated agent jobs. The CLI still runs its scanner in process with the user's token: this change does not add restricted-worker isolation, quarantine, protection, or USB access controls. Folder results show bounded traversal counts and finding counts; detailed finding inspection is still pending.

Additional checks (build sentinel-cli first):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\apps\desktop\tests\jobs.ps1
```

The tests execute real child processes for nonblocking start, completion, nonzero exit, cancellation, timeout and spaced/trailing-backslash arguments, plus actual CLI file/folder scans on disposable harmless text samples. They do not exercise file dialogs or prove full UI accessibility.
