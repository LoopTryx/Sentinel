# Ducky-only blocking continuation: native and existing-filter paths

14 October 2026. This is implementation and failure evidence, NOT working protection. Do not activate another existing-driver trial before the owner's requested restart clears the stale contexts.

## Native path

`DuckyNativeBackend.cs` validates exact keyboard class GUID, bounded physical ancestry and RP2040-Zero bus name. Hardware IDs are derived from that validated devnode, not arbitrary configured IDs. Native CM_Enable_DevNode on the healthy device succeeded, problem0 before/after, roughly1ms. Scheduled SYSTEM native enable preflight succeeded. A separately controlled native disable trial returned40 (CR_NOT_DISABLEABLE); immediate native enable verifiedproblem0, and the exact restore task was retired and receipt archived. Windows read-only status flags marked both keyboard and board not disableable. Do not force a broader device or disable internal controls to get a green result.

The targeted helper now uses self-contained encoded native recovery code, captured once along with the target and reused verbatim for both scheduled probes and rearm. Interactive native calls use the same source snapshot. Still requires actual disabled-state recovery acceptance; healthy no-op enable is not that acceptance.

## Existing filter fallback

The existing keyboard UpperFilters include keyboard/kbdclass; read-only Interception protocol probes found4 keyboard slots, exactly1 matching Ducky hardware IDs. No driver installation, removal, signing change, mouse-filter change or E: access occurred.

`DuckyFilterHold.cs` is a standalone Framework test helper, compiled by `tools/usb/tests/ducky-filter.ps1`. It uses the already installed driver's protocol. The worker derives hardware IDs from its validated native Ducky target; selects exactly one keyboard slot; changes only that slot; keeps mouse slots untouched; discards bounded reports without logging contents. It exits on connection/identity change: this is a connected-device hold, not reconnect or first-input prevention. An owned guardian assigns its exact child to a kill-on-close job before allowing filter mutation. Intended lease120sec with guardian timeout130sec. Release evidence must come from a fresh filter-zero probe of the original target and carries a run ID. A filter setting alone does not prove actual typing containment.

## Actual failed crash trial and required recovery

The first two-second owned-child crash test failed before a verified armed state. Read-only reproduction found the installed driver GET_FILTER returns success with a two-byte buffer value0 but reported bytecount0. The original strict bytecount2 decoder refused it. A bounded decoder now accepts only successful replies, exact two-byte buffer, and reported count0 or2; no other shapes accepted. This follows the library's fixed-value reply behavior, but actual filter write/readback remains required.

Both owned trial processes (guardian15292, worker33008, original artifacts/DuckyFilterHold.exe) remained present after an elevated cleanup verified executable and parent relationship and requested termination. Recorded in artifacts/ducky-filter-stop.json. Filter reset and release could not be verified. No `blocked:false` or restored-input claim is justified by failed termination. Normal controls were not deliberately filtered, but owner usability must be confirmed.

Owner has been asked to save work, unplug Ducky and manually restart Windows before another live trial. Do not restart automatically. After restart confirm no stale helper processes and observe current input usability. The old executable was in use; the current compilation outputs artifacts/DuckyFilterHold-v2.exe. Never confuse these revisions.

Context initialization has also been changed to register a manual-reset event before any filter operation, matching the documented library lifecycle; zero-filter probes now READ zero rather than write zero. This is an unverified correction candidate, not an established cause or a passing fix for stuck cleanup. Do not test on additional devices or broaden scope if it fails.

Protocol provenance: https://github.com/oblitum/Interception/blob/master/library/interception.c and interception.h. Independent C# adapter; existing third-party driver remains a dependency, not Sentinel-owned kernel enforcement. No raw hardware IDs or keystrokes should be published.

## Tests and next action

Full repository verifier passed at native replacement stage (artifacts/ducky-native-verify.log). Native target rejection, immutable recovery payload, ten hold/failure fixtures, directory anchoring and filter compile/uniqueness checks passed. Static review resolved target binding, mutable source reuse, connection reuse and falsely asserted release evidence. Last context changes still need review and live acceptance.

After owner recovery: perform ONLY bounded controlled filter lifecycle/crash test with positive harmless input evidence; verify no other control is intercepted, close/reset genuinely works, and an independent fresh driver read confirmszero. If cleanup stalls again, stop using that existing driver backend and record unsupported configuration. A correct signed input filter or another qualified admission mechanism is then required; do not pretend timers can release a kernel context that ignores termination.

Neither actual hold, harmless payload containment, post-crash Windows delivery, reconnection prevention nor whole USB quarantine is complete.

## After owner reboot — second lifecycle failure

Owner reported restart with Ducky absent, then reconnection. Old trial processes were initially absent. Second initialized-event no-blocking lifecycle probe run8824e0527b214767a2836b50cdf0b197 failed: filterZeroVerifiedfalse/releaseunknown. Worker exit signal was recordedtrue, but process entries remained; do not equate that with fully completed driver cleanup. Native target remains valid, problem0/hardwareIds2. Owner confirmed normal keyboard and mouse both work.

Decoder now compares two distinct prefilled output buffers, refusing successful zero-count calls unless the returned values agree. This avoids treating an untouched zero-initialized buffer as proof. Guardian checks actual WaitForExit result before a fresh probe; false leaves releaseunknown. Worker exceptions are caught to prevent unhandled exception reporting; this is a code correction, not proven kernel cleanup. No further live trials performed. Current artifact name is DuckyFilterHold-v3.exe, explicit --probe/--crash-test/--hold only; double-click without arguments refuses activation. Do not deploy this experimental fallback as protection or run another active trial with the unqualified existing driver.

Remaining prerequisite: a qualified device-specific admission/filter backend with trustworthy state and verified release on this configuration, or qualification on a recovery-ready test machine. Neither repeated timers nor successful compilation resolve the demonstrated live failure. Exact-device installation restrictions are a possible alternative to investigate under their own reviewed rollback and supported-OS gates; they are not implemented or tested by this increment.

Default build hard gate: --hold and --crash-test return exit12/unqualified_backend without launching a worker or applying a filter. Active experimental lab builds require explicit SENTINEL_USB_LAB_HOLD compiler define and separate reviewed qualification; do not use that define as permission to skip demonstrated cleanup failures. This refusal test passed. The helper is not installed or connected to the console as active protection.

Default worker and setter are gated too: direct --worker stdin cannot bypass qualification, and nonzero filter requests are rejected/compiled out without the lab define. Independent final static review approved publication of dormant implementation/failure evidence only; expressly not activation. Current tests compile cleanly and default --hold refusal passed.
