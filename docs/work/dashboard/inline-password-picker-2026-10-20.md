# Inline password picker - 2026-10-20

Owner requested an inline glass panel below password fields, actual Sentinel logo, no separate browser GUI, and retirement of the legacy master-key prompt.

Implemented in extension 0.2.37. Field panel is an extension-origin iframe with a translucent surface and parent-page backdrop blur. It is anchored to the exact clicked field, supports saved-login selection, generator and explicit Hello-backed saving. No windows.create or sidePanel.open is used by this path. Outside click and Escape close the panel. Saved-password values remain in the worker-to-original-document path; the panel receives matching metadata and completion results only.

Iframe actions require extension sender identity, bound request reference, matching tab, child frame, enabled feature and granted origin. Autofill still requires original HTTPS origin, original document ID and exact field marker. Pending captured submissions resume on subsequent top-frame pages, allowing explicit save after SSO without changing the recorded credential origin.

Windows native verification uses an invisible owner HWND which must activate; existing foreground and same-process guards remain intact. Only Windows Hello should be visible. Activation failure remains an error, never an authentication bypass. The legacy Yes/No vault confirmation was removed. On the next approved Hello initialization, incompatible old ciphertext is archived under a unique legacy backup before creating a fresh Hello vault. No existing real vault data was deleted, decrypted, reset or migrated during this task.

Verification: 21 focused password tests passed, extension build/parity smoke passed, both C# binaries compiled. Independent review found and resolved field/save/foreground-owner issues; live Hello acceptance remains unexecuted. Six installed extension locations verified at 0.2.37 with identical panel hashes; installed native bridge hash matched build. Installed console startup: navigation=True, glass=true, heading=Dashboard, backend=demo_runtime.

Visual browser fixture could not be loaded due localhost timeout in available browser automation. Actual Chrome reload, field-panel appearance and Windows Hello require owner verification. No valuable credentials used. No installer generated in this task.
