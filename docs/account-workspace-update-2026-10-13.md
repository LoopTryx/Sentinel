# Account workspace and desktop update

Owner requested concise account presentation, automatic extension connection,
rounded window corners, blur-to-tray behavior, local account audit highlights,
and Administrator Yes/No approval for password actions. Windows Hello was
explicitly declined. No Windows sign-in password collection is implemented.

## Delivered local candidate

- B desktop UI source 789e965 and warning mascot source 045eb4c incorporated,
  retaining A automatic USB inventory and passive Wi-Fi behavior.
- Accounts screen and extension 0.2.1 popup have one account list, copyable
  read-only email/website fields, masked password placeholder, protected Copy
  password and Generate Replacement actions. No unlock/health/tools tabs.
- Local strength/reuse audit toggles red/yellow/green/unknown highlights and
  a reduced-motion-aware sweep. Green means strong and unique, not safe.
- Unconnected account screen reports connection state, not fictional preview
  accounts. Session storage limitations remain under Storage & access.
- Native round region plus DWM corner preference, no caption action buttons,
  blur hides window and taskbar entry while retaining tray. Native picker and
  password/restore dialog activity suppress desktop blur handling.
- Existing nativeMessaging permission used at worker start, Chrome startup,
  popup state request and read-only reconnection. No mutation retries.

## Native operation contract

Renderer request: `{id:"request_1",method:"vault.copy",data:{id:"mail"}}`.
`vault.rotate` has the same shape. Account IDs are 1-64 ASCII letters, digits,
underscore or hyphen; extra fields refused. Response is `{ok:true}` or
`{error:"..."}`. No password or account editing authority returns to web UI.
Renderer timeout is 75 seconds; approval must finish within 60 seconds.

Extension trusted popup sends `demo_call` with method `vault.copy` or
`vault.rotate`. Background validates extension identity and popup URL, then
sends native `{operation:"copy",id:"mail"}` or `rotate`. Native host validates
its exact registered origin. Same success/error response, no secret output.

Both native callers serialize the entire approval/request/clipboard operation
with a shared named semaphore. Already elevated callers, disabled/silent UAC,
invalid operations, cancellation, late approval and unavailable runtime fail
closed. Helper does no privileged mutation and receives no password/token.
Native approval is elevation consent, not proof of user identity. UAC prompt
itself is OS-controlled; late consent is rejected even if the prompt stays open.
Runtime reveal/rotate require desktop bearer plus native action authority.
Ordinary renderer/browser requests cannot bypass approval. Captured runtime
credentials expire on restart. Clipboard contains the copied session password
until overwritten; this build does not promise clipboard-history removal.

## Evidence

- Full `tools/verify.ps1`: All available T01 checks passed.
- Final UI tests: 29 passing. Extension tests: 69 passing, including actual
  popup DOM behavior, native delegation, refusal and no secret response.
- Runtime tests: six passing, including refusal without native authority.
- Native C# build passed. `tools/test-password-approval.ps1` passed invalid
  operation refusal, concurrent thread/process refusal and lease release.
- Installed lifecycle smoke: hidden=True, reopened=True.
- Installed native connect issued a session accepted by authenticated runtime.
- Package: artifacts/Sentinel-Demo-20261013-100605; installed app updated and
  relaunched. Existing Chrome unpacked files updated with preserved backup.
- Independent reviewer found consent/timeout gaps; both fixed and re-reviewed,
  no remaining installation blocker for synthetic session accounts.

## Unexecuted acceptance / next actions

Chrome is not exposed to current browser controls. Owner must reload Sentinel
once at chrome://extensions, confirm version0.2.1 popup and automatic connection.
Click Copy password: decline UAC and confirm refusal; repeat and approve to copy
a harmless session password. Generate Replacement: decline leaves revision
unchanged, approve changes local account audit. Do not use valuable credentials.
Check actual rounded visual appearance and blur behavior on owner's desktop;
native lifecycle tests are not a manual visual rehearsal.

Field editing, persistent encrypted vault, real account password changes and
Windows sign-in password auditing are not implemented. This local installation
does not imply coordinator integration into main or whole-S1 completion.
