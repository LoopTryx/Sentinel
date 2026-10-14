# Known Ducky keyboard hold — implementation contract

This helper targets exactly one currently connected RP2040-Zero keyboard correlated by Windows parent ancestry. Bus labels and IDs are spoofable; it is a known-device demonstration, not malicious-device classification. No first-input prevention is claimed. It does not modify USB installation policy, internal controls, storage, firmware, Defender or E:.

Entry point: tools/usb/targeted-hold.ps1. Probe is read-only. Hold/Restore/Status require Administrator approval. No elevation is silently attempted.

```powershell
& tools/usb/targeted-hold.ps1 -Mode Probe
# From an elevated PowerShell, after review/recovery prerequisites:
& tools/usb/targeted-hold.ps1 -Mode Hold
& tools/usb/targeted-hold.ps1 -Mode Status -ReceiptPath '<exact receipt returned by Hold>'
& tools/usb/targeted-hold.ps1 -Mode Restore -ReceiptPath '<same exact receipt>'
```

Hold exercises a SYSTEM scheduled task running only Windows pnputil /enable-device on the healthy exact target. It then replaces that test trigger with an automatic restore at 120 seconds, repeating every minute indefinitely until verified restoration retires it. A delayed hold cannot permanently outlive a one-shot recovery task. The deadline is rechecked after receipt persistence and identity validation before disable. Repeating recovery means this is a bounded temporary test hold, not persistent quarantine.

Receipts are private under ProgramData/SentinelTargetedUsbHold: atomically created protected directory, trusted owner and ACL, retained ancestor/directory native handles without delete sharing, no reparse directories; exclusive receipt creation and Flush(true). Native C# directory anchoring compiled and refused rename until release on a disposable test directory. No workspace script is scheduled as SYSTEM.

Core functions: Invoke-SentinelTargetHold(ticket, provider) and Invoke-SentinelTargetRestore(receipt, provider). Providers are internal trusted callbacks, never public IPC. Ticket includes keyboard/root/private nonce/restoreDeadline; native helper adds owned task. Hold saves receipt before mutation, requires problem0 then verifies problem22. Restore revalidates exact current keyboard/root, enables and verifies problem0 before task retirement and receipt archival. Failed restore retains recovery intent. Hold failures retain the restore task/receipt and attempt immediate enable after a native disable failure. No cancellation of rollback when the console exits. Private identifiers are not printed in ordinary status, but must remain in private task arguments/receipts for native reversal.

Probe response: device, keyboardInterfaces, problem, blocked, scope=known_connected_device, firstInputPrevention=unverified. Hold returns held/problem22/automaticRestoreUtc/private receipt location. Restore returns restored/problem0. Disconnection, ambiguous boards, changed ancestry, pre-disabled/unhealthy node, expired deadline, insecure paths, unverified task and failed native operations are errors, not success.

Evidence this increment: read-only actual RP2040-Zero probe found one healthy keyboard, blocked=false. Ten synthetic state/failure tests passed including expiry after persistence, identity drift, failed receipt write, failed disable/readback and failed restore. Native directory anchoring test passed. No actual Hold/Restore, privileged scheduled task execution, harmless typing containment, console integration or reconnect persistence has been tested. These remain acceptance requirements. Do not enable a UI blocked state from fixture output or mere task registration. Existing broad quarantine remains unfinished.

Regression commands:
```powershell
foreach($case in @('Healthy','Mismatch','PreDisabled','RestoreFailure')) { & tools/usb/tests/targeted-hold.ps1 -Scenario $case }
& tools/usb/tests/targeted-hold-failures.ps1
& tools/usb/tests/targeted-hold-native.ps1
```

Next: review the exact privileged helper, confirm independent recovery task on the real target without disabling, then a temporary targeted hold and verify problem22 plus absence of harmless typing, followed by automatic problem0 restoration. Record reboot/reconnect coverage separately. Do not claim containment from Windows state alone. No broad policy trials are performed by this helper.

Independent static review: atomic directory provisioning, retained handles, repeating restore, durable receipt and serialization reviewed; no remaining static blocker reported. Full tools/verify.ps1 passed (artifacts/ducky-targeted-verify.log). Any live outcome is separate from these results.

Live attempt: owner approved elevation; helper failed and did not return held/problem22. Separate native readback found keyboard problem0. Privileged inspection found zero receipt files and one owned restore task; its presence does not prove successful hold. Exact failure stage was not captured by the initial wrapper. Added fixed phase labels and reduced repeat revalidation to the exact pinned keyboard/ancestry; these changes are not a proven fix. Do not repeat the live hold until task/receipt state is resolved and failure reproduced. No typing containment or restoration-from-disabled result established.

Failed-trial cleanup verified: keyboard problem0, no receipts, removed exactly one task after matching its fixed pnputil path, exact private target argument, SYSTEM principal and owned nonce name. No live hold remains active. Cleanup result stored locally in artifacts/ducky-trial-cleanup.json.
