# Profiled Ducky control in Sentinel

## Implemented scope

USB Guard → Manage device and the tray menu → Profiled USB control open the same native panel. Hold for 5 minutes and Release request Windows administrator approval through a fixed-purpose compiled helper. The renderer only opens the panel; it cannot submit a device identity, arbitrary command, path or policy data.

The helper uses the already qualified device profile in the administrator/SYSTEM-only ProgramData journal. There is no automatic enrollment of attached devices. Other machines without that profile refuse the action. This is known-instance Windows installation control, not general unknown-HID quarantine, power switching or a cryptographic device identity.

Hold first qualifies an immutable repeating SYSTEM recovery action against a private registry probe. It preserves a durable receipt and continuous recovery coverage, binds to the exact profile, then sets the selected deny entry and refreshes Windows policy. Automatic and explicit release both remove only the owned entry and refresh policy. Global flags and foreign policy are not erased. Rearming requires the previous device recovery to be healthy; unresolved task retirement refuses another hold until Release finishes recovery. Both task identities survive an interrupted retirement.

Machine profile metadata is created atomically with SYSTEM/Administrators write access and Users read access. Status validates the profile, policy schema and value types. Armed is distinct from a missing device driver; problem 28 is not represented as proof of policy causation. Native notifications report state changes and requested-action completion; timeout outcomes remain unknown. Closing Sentinel does not cancel scheduled recovery.

## Actual device evidence

The first registry-only attempt did not stop the payload: root and keyboard problem codes remained zero. After Windows policy refresh and reconnect, the owner reported “The installation of this device is forbidden by system policy.” Native readback recorded root error/problem 28 and no present correlated keyboard. This is a tested configuration, not universal first-input prevention.

Removing the deny entry alone did not restore the device. After policy refresh, native root problem returned to zero, and the owner explicitly confirmed QUACK ran again with normal keyboard and mouse working. The original completed trial task was retired only after those recovery checks. CRYPTIC E:, Defender and unrelated input policies were unchanged.

## Verification

- Full native-access tools/verify.ps1: passed, artifacts/ducky-app-verify.log. Initial sandbox-only temporary-storage failures are retained separately.
- Desktop build, including the dedicated manifested helper: passed, artifacts/ducky-app-build.log.
- Visible glass-console smoke: passed, artifacts/ducky-app-smoke.log.
- Focused USB UI tests: 3 passed, artifacts/ducky-ui-tests.log.
- Private exact-entry tests: interrupted write prefixes, foreign entry preservation, ownership/target drift refusal, expired-arm refusal and repeat arm/release passed.
- Fixed-purpose helper command rejection and retirement-timeout/restart regression: passed via apps/desktop/tests/ducky-policy.ps1.
- Actual private HKLM enrollment publication, rebinding refusal, partial-record refusal and restart refusal: passed via apps/desktop/tests/ducky-enrollment.ps1. No actual USB policy was altered by these metadata tests.
- Independent review findings on task coverage, task tracking, atomic enrollment, profile-bound status, timeout wording and recovery UI were addressed.

## App acceptance route

Open USB Guard → Manage device. Choose Hold for 5 minutes and approve Windows. Reconnect the enrolled Ducky; record the Windows result, harmless payload outcome, normal input usability and notification visibility. Choose Release and approve Windows; reconnect and confirm the harmless payload and ordinary controls again. Repeat the cycle, then leave the device released. These app-button and notification observations remain pending until actually performed; the prior direct controlled trial does not substitute for them.

This implementation is on the owned PR74 branch pending coordinator integration. It does not complete broad USB input quarantine or the whole S1 milestone.
