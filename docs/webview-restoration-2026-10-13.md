# Restored console and v6 warning integration

Owner chose to retain the original HTML/CSS design in WebView2 after rejecting
the native-controls redesign. NativeConsole.cs and the native build scripts
remain preserved locally but are not compiled or installed in this candidate.

## Desktop behavior

- Original shell, animated background, sidebar and account layout restored.
- Former 42-pixel WPF title strip collapsed. Minimize and Close controls are
  placed at the upper-right of the existing UI and call trusted `window.hide`.
  Both hide the window/taskbar entry while leaving runtime/tray alive.
- A single left tray click opens the console. Focus loss hides it, except during
  native picker or approval handling. Rounded window region remains enabled.
- Native browser context menus disabled. DOM context-menu and drag events
  prevented; ordinary text is nonselectable. Input fields retain keyboard copy
  and selection. These preferences do not provide a security boundary.
- Account actions: protected `vault.view`, `vault.copy`, `vault.rotate`,
  `vault.remove` `{id}` and `vault.add` `{name,user,host}`. Add accepts metadata
  only and generates a unique locally strong password; no credential import.
- View requires per-action UAC approval and active visible host. It clears on
  selection/revision, blur, navigation/unmount, 30-second deadline, and native
  hide. Explicit native hide revokes pending reveals using an epoch. UAC-driven
  blur only clears visible data, preserving normal approved-view operation.
- `Local strength and reuse check` caption removed. Storage limits remain in
  expandable settings. Login changes remain session-only, not a persistent vault.

## Engineer B v6 artifact

No ZIP exists in fetched branch/tag/PR commit history. The actual artifact is a
draft GitHub release named `extension-v6`, release411471698, asset636444204,
target d2ce7c0aa27766c33d5c7ddbdd773d3b4c53a06a.

`sentinel-extension-v6.zip` SHA-256:
`d78371ec149548ebfa6211a49c4eb6b8829adf14844303d445b3779a5e6c4414`.

Download digest verified before bounded archive extraction. Imported exact v6
warning HTML/CSS/script/mascot. Retained updated account popup, native automatic
connection and protected actions. Archive's older manual-pair/unlock/generator
UI was not reintroduced. Integrated extension manifest version is0.2.2; v6 is
the release artifact label, not its original manifest version (0.2.0).

## Evidence and remaining acceptance

- Final UI:32 tests passed, including actual add-form metadata delegation,
  protected viewing, masking and late-response refusal after native clear.
- Runtime:7 tests passed, including native-only add/remove, duplicate normalized
  account refusal, no password import or secret-bearing state response.
- Extension:69 tests/build/parity smoke passed after importing v6 warning assets.
- Full tools/verify.ps1 passed; focused checks repeated for subsequent changes.
- C# build passed. Installed tray lifecycle: hidden=True, reopened=True.
- Restored installed runtime responds to authenticated state request; app
  relaunched. Existing Chrome unpacked files and installed package extension
  directory updated to0.2.2. V6 warning CSS hash matches verified release asset.
- Independent review found pending-reveal clear race; fixed and re-reviewed.

Actual UAC Yes/No, single physical tray click, final visual screenshots and Chrome
reload/popup acceptance are unexecuted. Chrome/native UI are not exposed by the
current computer controls. Owner must reload Sentinel once at chrome://extensions.
No main integration, persistent vault, live browser completion or S1 completion
is implied by this locally installed candidate.
