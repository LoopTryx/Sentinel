# Implementation status

Updated: 2026-09-29

| Task | State | Evidence |
| --- | --- | --- |
| T00 Capability and threat-model dossier | In progress | Initial host inventory and untested capability matrix in `docs/evidence/capability-matrix.md` |
| T01–T17 | Not started | No product implementation or verification evidence yet |

## Next T00 work

1. Confirm OS edition/build and Defender state with an authorized host inventory; the current shell denied CIM and Defender status queries.
2. Record administrator access and owned disposable VM/USB/HID equipment.
3. Run the specified policy, Wi-Fi, worker-isolation, ClamAV, and native-host probes in disposable environments.
4. Record actual results, fallback decisions, dependency licenses, and a working pinned toolchain before closing T00.

No USB enforcement experiment should run on the daily-use machine during discovery.
