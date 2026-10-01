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

## Asynchronous selected scans

The Files page now supports selecting a file or a folder. A dedicated local CLI process runs outside the WPF dispatcher; navigation remains available. An indeterminate activity bar and elapsed time show that work is running, without inventing percentage progress. One scan runs at a time.

Cancel terminates this preview CLI process; a 120-second deadline also stops hung processes. Cancelled/timed-out/failed jobs have incomplete coverage and no completed verdict. Closing the window requests termination of the owned scanner. Diagnostics are not copied into the UI, because they may contain selected paths. Results are kept only in the current window.

These are local preview process jobs, not persisted authenticated agent jobs. The CLI still runs its scanner in process with the user's token: this change does not add restricted-worker isolation, quarantine, protection, or USB access controls. Folder results show bounded traversal counts and finding counts; detailed finding inspection is still pending.

Additional checks (build sentinel-cli first):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\apps\desktop\tests\jobs.ps1
```

The tests execute real child processes for nonblocking start, completion, nonzero exit, cancellation, timeout and spaced/trailing-backslash arguments, plus actual CLI file/folder scans on disposable harmless text samples. They do not exercise file dialogs or prove full UI accessibility.
