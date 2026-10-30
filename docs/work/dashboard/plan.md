# Laptop dashboard and download protection — approved design

Owner approved on 2026-10-18: replace current Console widgets with native laptop metrics, quick/full scan controls and recent security activity; move Sentinel AI lower; remove Threat Log navigation and extra tray USB Guard command; remove product-facing Demo labels without relabeling fixtures as protection.

## Implementation plan (superseded runtime decision below)
- [ ] DeviceHealth.cs: bounded cached read-only CPU, GPU, memory, battery, OS, fixed-disk and uptime snapshot; no raw identifiers or protected E: access.
- [ ] Dashboard.tsx/dashboard.css: responsive laptop overview, actual unavailable states, scan controls, monitoring control and activity; existing design tokens/sidebar retained.
- [ ] NativeSecurity.cs: one serialized scan queue, known-folder Downloads arrival watcher, completed/stable-file gating, local-only event state, real installed Defender scan invocation and truthful permission/error states. No disabling Defender, no malicious fixtures, no foreign process cancellation, no new USB actions.
- [ ] Keep confirmed Windows detections/remediation in Windows Security; do not forge Sentinel vault receipts. Suspicious-only indicators stay reviewable. Native renderer API accepts modes and switches, never paths or commands.
- [ ] Focused policy/queue/UI tests, unchanged full verifier, native build and actual harmless download scan; install and visibly launch. GitHub remains unavailable; retain all changes locally.

Full scan scope must be explicit, omit protected/removable drives, and refuse link traversal. Never substitute an incomplete enumeration for a completed clean full-system scan. Application-level watching is active only while Sentinel runs; do not claim a kernel pre-execution interception service.

## Owner correction and final verification
Dashboard scans now use the existing Sentinel Rust engine, never Defender. See sentinel-engine-2026-10-19.md for current scope, exact limits, installed acceptance and the automatic-quarantine gap. Historical Defender items above are not the shipped runtime.
