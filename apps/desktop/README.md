# Sentinel native desktop preview

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
