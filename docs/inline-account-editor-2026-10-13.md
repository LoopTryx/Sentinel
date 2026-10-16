# Inline account editor and protected mutations — 13 October 2026

Candidate: codex/engineer-a/desktop-v2-20261013. Installed package: artifacts/Sentinel-Demo-20261013-134230.

## UI behavior

Plus creates one unsaved account row. Edit its name inside All accounts, and email/username, hostname and password in the detail panel. Save changes commits the selected draft/edit after native Windows approval. Minus discards a draft or requests approved removal. Eye requests approved reveal of a saved password; copy requests approved native clipboard writing. Copy is disabled for unsaved password changes. Wand opens the prior generator's length and character controls in a modal; generation uses local cryptographic rejection sampling and fills the password draft without automatically saving or copying. Escape closes the modal. Hidden windows revoke visible secrets and pending reveals without discarding successful mutation receipts.

## Native contract

`demoCall('vault.add', {name,user,host,password?}) -> {ok:true,id}`
`demoCall('vault.update', {id,name,user,host,password?}) -> {ok:true}`
`vault.view/copy/remove` retain `{id}` input. Update does not replace the password if `password` is omitted. Names <=80, user <=254, hostname <=253, optional nonempty password <=256; controls rejected. Up to128 accounts. Duplicate user/hostname conflicts return409; invalid input400; missing native authority403. Ordinary desktop bearer and browser callers cannot mutate or reveal. Native caller verifies exact renderer origin, request bounds, subject ID and cross-process action lease, obtains approval with only operation/id as helper arguments, and posts data to authenticated loopback. Passwords never enter event history/state snapshots/command arguments. Bodies are not logged. Approval is not identity authentication. No real credential import, encrypted persistence or website password change is claimed; records remain in memory for the session.

## Evidence

38 UI tests passed (artifacts/inline-vault-tests.log),8 focused runtime tests passed (artifacts/inline-vault-runtime.log), native approval/lease regression passed. Full tools/verify.ps1 passed (artifacts/inline-vault-full-verify.log); the final mutation/reveal epoch separation then passed UI tests and UI/native builds again. Independent static reviewer found revision and hide-during-save races; fixed and covered by regression. Installed browser and physical GUI/UAC acceptance remain manual.

Owner explicitly approved changing Windows administrator consent policy from0 to2 and secure desktop to1; applied, EnableLUA remains1. Previous values backed up in artifacts/admin-consent-before.json. This fixes a policy prerequisite, not proof of a clicked Show password prompt.

## Acceptance

1. Open Passwords; plus should create a row without a separate add form.
2. Name the row, fill detail fields, save; approve the Windows prompt. Verify the row remains and reload state has metadata but no raw password.
3. Select it; eye should display UAC before revealing. Copy should display UAC before clipboard write. Rejecting approval leaves the record unchanged.
4. Edit metadata/password; save with approval. Use wand, adjust length/options, then Use generated password and Save changes. Generator alone must not mutate the saved login.
5. Minus requires approval for saved records; draft minus only discards local input. Hide/reopen during pending reveal must not reveal stale text. Hide/reopen during save must reconcile successful completion.

NativeConsole.cs remains preserved and untracked. No main merge or release completion claim.
