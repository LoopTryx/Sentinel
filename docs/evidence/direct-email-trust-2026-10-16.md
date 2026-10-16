# Direct email trust and native popup — 16 October 2026

Owner follow-up on PR75, branch prattyush-changes-for-v3, parent 9ce4da3.

The toolbar once again opens popup.html through action.default_popup. Both existing mascot PNGs overlap the inner navy card inside a 520x600 native popup. Chrome owns the rectangular outer surface; no custom-shaped/see-through native window is claimed. The prior in-page panel modules remain dormant on normal toolbar clicks for a small reversible change.

Trust this sender saves the displayed snapshot sender directly through email_trust_current. The runtime requires a real user click and a still-current email snapshot. Worker checks own-extension sender, supported HTTPS top-frame provider, opt-in/site permission, exact kind/address fields and a canonical address observed in that same tab/document within ten minutes. Observations are memory-only, capped at 32 tabs and eight addresses per tab, expired/pruned on observations and removed when provider warnings are disabled. Existing storage serializes/bounds writes and remains TRUSTED_CONTEXTS-only. No email body is stored/uploaded. The button requires trusted:true acknowledgement, has pending/error/retry states and disables after success. Strong-risk scoring and link guards are unchanged; trusting a sender does not verify their identity or remove a current serious warning. Sender management/removal remains in Settings.

Verification: 135 dedicated extension tests passed; final 15 focused email authorization/UI tests passed after document binding and disable/re-enable guards. Browser automation remains policy-blocked; no workaround was attempted. Actual installed native popup appearance and real Gmail/Outlook click acceptance remain owner manual tests. Independent Engineer A security review required before integration. No merge/release.

Full tools/verify.ps1 passed (native checks, 41 UI tests and extension build/smoke). Final focused checks cover document mismatch and stale observations after disable/re-enable. No installed browser acceptance claimed.
