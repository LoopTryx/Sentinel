# Saved Ducky Group Policy implementation plan

Goal: qualify the owner-approved saved-local-GPO alternative for the exact enrolled Ducky, without claiming a fix before hardware acceptance.

Architecture: a separate COM local-GPO session edits only an owned exact-instance policy. A pure registry-key adapter permits native private-HKCU failure tests. Recovery removes the saved entry before clearing effective policy. Existing v1 helper and recovery actions remain unchanged until the new persistence/recovery path is qualified; no forced task migration.

Constraints: no class-wide denial, driver/filter changes, hubs/controllers, E: access or firmware changes. Preserve unrelated policy. Save failure means unknown outcome, never armed success. Detect external local-policy change before save and refuse. COM calls use one STA thread. No live entry point enabled in the first increment.

- [x] Write and reproduce failing persistence/release tests, including unrelated policy, foreign target/nonce, interrupted saves and repeat release.
- [x] Implement guarded key mutation plus supported COM load/save, with change detection and native error propagation.
- [x] Test native COM read-only binding and private save/apply/release, including an injected post-save error. This does not qualify independent SYSTEM recovery.
- [ ] Obtain independent review of persistence, recovery and concurrency behavior.
- [ ] Wire self-contained SYSTEM recovery and fixed helper only after private save/recovery qualification, retaining old action migration checks.
- [ ] Build/install candidate, then require positive baseline, repeated refusal, unaffected normal controls, manual release and timed release without restart.

Sources: Microsoft IGroupPolicyObject OpenLocalMachineGPO/GetRegistryKey/Save; Registry Policy File Format; RefreshPolicyEx.

Blocking evidence: independent SYSTEM test was Defender-blocked; exact repeating private task removed. No GPO live activation or installed update. Review requires bounded worker execution before earliest outstanding recovery deadline and actual hung-lock containment tests. Source-based recovery transport must be investigated without Defender exclusions or detection evasion.
