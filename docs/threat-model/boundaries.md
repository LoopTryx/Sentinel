# Trust boundaries and initial threat model

Status: initial T00 model; validation pending. Source: v3 master plan sections 2, 4–6, and 8/T00.

## Protected assets

Vault keys and plaintext, user files and quarantine contents, device policy state and its recovery journal, local assessments and baselines, browser-origin binding, update provenance, and private diagnostics.

## Adversaries and entry points

- Hostile file or archive: reaches only a bounded, non-elevated worker through an approved handle.
- Hostile page or extension message: cannot choose a trusted origin, arbitrary privileged path, or generic broker command.
- Hostile USB device: may spoof VID/PID/serial and expose composite interfaces; approval history is not attestation.
- Hostile feed or compromised update source: cannot bypass authenticated manifest and payload checks; stale data must be shown as stale.
- Same-user process: may observe user-accessible resources, so vault process and broker authority must remain separated.
- Malicious message text: processed locally in memory and never logged or automatically sent.

A fully compromised administrator/kernel/OS is outside the initial protection claim. Device firmware attestation is also out of scope.

## Required boundaries

The SYSTEM broker permits scoped Windows operations, not hostile parsing or vault access. Named-pipe authorization comes from the actual client token/SID and session; request fields do not grant identity. Remote clients are rejected. Browser requests are restricted to allowlisted operations, validated sender tab/frame/current URL, and user-gesture-bound selected credential release. Workers have no arbitrary network or unrelated file access. Every OS mutation has preview, admin authorization where required, a durable journal, and recovery.

Negative tests must prove that untrusted callers cannot invoke policy changes, read arbitrary privileged paths, restore unrelated quarantine items, retrieve vault secrets, or make the product report complete coverage after a failed or skipped check.
