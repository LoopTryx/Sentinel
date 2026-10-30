# Passwords workspace and field-tool recovery - 2026-10-20

Owner reported the field logo missing and rejected the no-field instruction panel shown by the Passwords tab.

The Passwords tab now renders the full vault in the existing extension-origin browser overlay: search, account list, selected details, masked secret, explicit Hello-backed show/copy/edit/save, generator, lock and website-tools controls. The compact field picker remains separate and anchored to the selected field. No window or side-panel launch added. Overlay expands for Passwords and restores width for Settings; narrow screens stack list and detail.

Authority change: embedded popup manager-open issues a random ten-minute grant bound to sender tab, frame and document, bounded to eight grants and persisted in TRUSTED_CONTEXTS session storage. Vault calls require this grant; native Hello remains required for sensitive operations. Expired grants renew on next vault call. Enable derives injection tab from the authenticated grant. Field-vault authorization remains separately restricted to its capture reference, document and field.

Icon recovery: previously enabled website tools are reconciled on startup/update/toolbar click only when HTTPS permission remains granted. Registered scripts update and reinject into open HTTPS tabs. Versioned content rescan restores removed icon hosts, avoids duplicate current-version listeners and uses the Sentinel PNG.

Evidence: 26 focused password tests passed; build and dist parity smoke passed. Independent review found no remaining blocking source issue. Synthetic IAB browser fixture visually verified field logo -> inline picker and full vault list/details; fixture did not invoke real Hello or read saved passwords. Preview image: artifacts/password-workspace-preview.png. Broader extension test invocation stalled after unrelated message-AI tests and was interrupted; it is not a passing full-suite result.

Installed 0.2.38 into six existing extension locations with backups and exact hashes for changed runtime/UI modules; receipt artifacts/password-workspace-installed.json. Actual Chrome reload, third-party-page icon visibility and Windows Hello focus return remain owner acceptance. No installer produced or native binaries modified in this turn.
