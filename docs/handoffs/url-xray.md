# URL X-Ray: GLM integration handoff

Issue #14, school-showcase local explanation increment. Codex owns the parser and DTO; GLM owns presentation. This leaf function is implemented; desktop/native IPC wiring remains separate work.

Call `sentinel_intel::url_explanation::explain_url(&str) -> Result<sentinel_proto::url_explanation::UrlExplanation, UrlExplanationError>`. Generated TypeScript types live in `packages/contracts/src/generated/UrlExplanation.ts`, `UrlReason.ts`, and `UrlExplanationError.ts`. Do not hand-edit them. No new external dependency is needed; intel now depends on the internal proto crate.

For a reproducible demonstration with invented data:

```powershell
cargo run -p sentinel-cli -- url explain-local 'https://trusted.test:invented@evil.test:8443/login'
```

The result identifies `evil.test`, port 8443, and `embedded_credentials` / `unusual_port`. It never contains the original input, username, password, path, query, or fragment. CLI arguments can appear in shell history/process listings, so use invented examples only; the UI should invoke a library-backed command rather than assemble a shell command.

## Rendering contract

Show `hostAscii` in full as the actual destination, together with scheme and effective port. `registrableDomain` is null because public-suffix classification is not implemented. Do not infer an organization from the last two labels. Render strings as text; do not open the destination automatically.

| Reason | Suggested explanation |
| --- | --- |
| embedded_credentials | Text before @ can disguise the actual destination shown here. |
| unencrypted_http | This URL uses HTTP rather than HTTPS. |
| ip_literal | The destination is an IP address rather than a domain name. |
| internationalized_host | The ASCII hostname contains internationalized labels; review the full destination. |
| unusual_port | This URL specifies a non-default port. |

Results always carry `coverage: partial`, `confidence: low`, `networkAccessed: false`, and `reputationChecked: false`. With no flags, `risk` is `unknown`; with flags, it is `suspicious`. Neither state proves safety or malware. HTTP, IP addresses, internationalized domains, and custom ports can be legitimate. HTTPS alone does not establish trust.

The input limit is 2048 UTF-8 bytes, enforced by the backend. Raw whitespace, controls, backslashes, selected invisible/bidirectional characters, missing authorities, invalid ports, and unsupported schemes are rejected. Error codes are `too_long`, `ambiguous_input`, `unsupported_scheme`, and `invalid_url`. Display a helpful error without logging or repeating rejected input. No network requests or reputation lookups occur.

## Integration acceptance

Wire the DTO through an explicit desktop/native command before marking the UI usable. Demonstrate a normal reserved domain, misleading userinfo, an internationalized hostname, an HTTP IP address, and rejected input. Show the limitation beside the result; do not present this as active browser protection. Preserve the original input only in the user's editing field, not diagnostics or telemetry.
