# Local password reuse audit - issue13

This independent, synthetic-tested library increment supports the owner's expanded shared password manager. It is not an encrypted vault, import, authenticated endpoint, strength checker, autofill or complete shared-client journey. Valuable credentials remain blocked pending independent vault/security review. No dependencies, browser permissions or current UI behavior change.

## Authoritative entry and output

`sentinel_proto::password_reuse::audit_password_reuse(passwords: &[&str]) -> Result<PasswordReuseAudit, PasswordReuseAuditError>`

Inputs stay inside the future reviewed vault-owning process. They are borrowed; the helper does not clone, persist, hash, serialize or log them. There is deliberately no browser/RPC input DTO accepting plaintext passwords. The caller owns buffers, memory cleanup/zeroization, unlock authorization, record selection and subject lifetime. This helper is not constant-time cryptography, credential isolation or proof that the process cannot expose memory. Never send its inputs to AI, diagnostics or activity.

Authoritative output DTOs are in crates/sentinel-proto/src/password_reuse.rs. Regenerate both TypeScript types through cargo test -p sentinel-proto, never hand-edit packages/contracts/src/generated/PasswordReuseAudit*.ts. Checked counters/indices are u16 bounded to128, safely represented as JS numbers. These types are output-only; Rust does not deserialize browser-supplied audit reports as authority.

Synthetic native call: `audit_password_reuse(&["invented-A!", "invented-B!", "invented-A!"])` produces:

```json
{"checkedItems":3,"reusedGroups":[[0,2]]}
```

Indices are zero-based in the exact admitted batch. Groups are ordered by first occurrence and members by input index; only groups of two or more are present. Comparison is exact UTF-8: no trimming, case folding or Unicode normalization. Identical passwords for separate accounts are detected regardless of origin; duplicate records themselves must be handled by the future import/vault owner. Distinct or omitted passwords are not strong, safe or breach-free.

## Bounds, errors and state

The complete supplied batch must contain at most128 items, each nonempty and at most1024 UTF-8 bytes. Count is checked first; then items in order. Whole-batch fixed errors: too_many_items, empty_password, password_too_long. No offending index, text, partial groups or checked count are returned on error. Example serialized error is `"password_too_long"`. Empty batch is a valid explicit zero-item audit: checkedItems0, reusedGroups[]. It does not mean a vault was examined.

At most8128 bounded pair comparisons; secret bytes are borrowed, group storage contains at most128 indices. Local synchronous work has no progress/cancel/timeout API in this increment. No claimed runtime deadline; the future owner checks session cancellation/version before and after the call and suppresses stale publication. Do not silently truncate a larger vault or split into batches and claim a complete audit: cross-batch reuse would be missed. Show a limit/unavailable state or obtain reviewed whole-vault behavior first.

## GLM and runtime integration handoff

Keep the capability unavailable until reviewed encrypted vault ownership and authenticated desktop/extension endpoints exist. On an explicit authorized audit, native owner snapshots selected record identities plus unlocked-session/record-version correlation privately, borrows passwords and returns this output only while that same snapshot remains current. UI maps indices using the retained same request snapshot, never current list order. Lock, edit/import, reorder, dismissal, navigation or session replacement invalidates the result; clear reused badges and suppress late callbacks. Indices alone are correlation, not authorization to reveal/fill/copy/delete. No vault metadata/secret upload is authorized by an audit.

Both clients must consume the same reviewed native result rather than sending secrets into an extension-local reimplementation. UI copy: "Exact reuse detected in this selected batch"; for no groups: "No exact reuse in this selected batch" with separate strength/coverage states. Audit errors are unavailable/incomplete, not a green result. Cryptographic generation, encrypted storage, import and website password changes have their own functions and acceptance; generating or saving a password does not change the website account.

## Reproduction and evidence

Run `cargo test --offline -p sentinel-proto --test password_reuse`, then `cargo test --offline -p sentinel-proto --lib` for generated outputs and strict proto clippy. Three tests cover stable multiple-group identity, exact case/whitespace/Unicode distinctions, empty/one-item batches, all size/count boundaries including128 identical1024-byte values, and secret-free report JSON/Debug/fixed errors. Initial test run failed at unresolved module/API before implementation; this is new-feature test-first evidence, not a deployed regression. After implementation all three tests and18 binding-export tests pass, and strict proto clippy passes. No real password, export or vault file was accessed.

Remaining acceptance: reviewed vault/KDF/encryption/backup/key ownership, import preview and consent, origin/gesture/session binding, real shared-client synthetic journeys and independent security review. This increment cannot close #13 or S1.

Final verification: full tools/verify.ps1 exited0 with All available T01 checks passed in an isolated current-main archive using its own Cargo target and96 cached pnpm packages (zero downloads). Workspace formatting/strict lint/tests, generated parity, TypeScript checks/build and extension tests/build/smoke passed. Smoke prints manual Chrome instructions; no new installed-browser journey was run or claimed.
