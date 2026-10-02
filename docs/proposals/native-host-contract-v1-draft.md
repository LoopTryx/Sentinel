# Native-host message contract — draft v1 (proposal)

Status: DRAFT for review · Author: GLM 5.3 · 2026-09-30 · Review discussion: `chat.md` msgs 6–7
Scope: Chrome extension ↔ native messaging host. The host↔agent pipe stays inside `sentinel-proto`/`sentinel-svc` and is out of scope here. **No `nativeMessaging` permission is added until this contract is agreed.**

## 1. Transport and framing

- The Chrome boundary uses **Chrome native messaging framing**: a 32-bit length in **native byte order** (little-endian on our Windows target) followed by UTF-8 JSON. This is deliberately **separate** from `sentinel-proto`'s internal big-endian length-prefixed RPC framing; `encode_frame` is not reused across the two boundaries.
- Application cap: **1 MiB per message in both directions** (matches the master-plan RPC cap). Chrome's own limits are asymmetric (host→Chrome 1 MiB, Chrome→host 64 MiB); the 1 MiB product cap applies regardless, in both directions.
- The host writes frames to **stdout only**; **stderr** carries diagnostics and is never parsed by the extension.
- The extension applies the same cap before sending; an oversized outgoing message is a client-side `oversized` error, never a truncated send.

## 2. Envelope

One JSON object per frame, both directions:

```json
{ "schemaVersion": 1, "id": "0b6f0e52-8f2e-4d8a-9d3e-6f5a1c2b3d4e", "kind": "url.assess", "payload": { "url": "https://example.test/page" } }
```

Successful assessment response — **complete `sentinel-proto` Assessment schema** (all required fields present):

```json
{
  "schemaVersion": 1,
  "id": "0b6f0e52-8f2e-4d8a-9d3e-6f5a1c2b3d4e",
  "kind": "assessment",
  "payload": {
    "id": "asmt_01J9Z7X2KQ",
    "subjectRef": "url:https://example.test/page",
    "risk": "none_observed",
    "confidence": "low",
    "coverage": "partial",
    "checks": [
      { "id": "local_parse", "state": "pass", "reasonKey": "web.check.localParse.pass", "evidenceRefs": ["ev_1"] },
      { "id": "intel_lookup", "state": "skipped", "reasonKey": "web.check.intel.unavailable", "evidenceRefs": [] }
    ],
    "reasons": [{ "code": "no_feed_available", "messageKey": "web.reason.noFeed" }],
    "actions": [{ "id": "open_learn_more", "requiresAdmin": false }],
    "engineVersions": { "harness": "0.1.0" },
    "observedAt": "2026-09-30T12:00:00.000Z",
    "expiresAt": null,
    "lessonIds": []
  }
}
```

Error response:

```json
{ "schemaVersion": 1, "id": "0b6f0e52-8f2e-4d8a-9d3e-6f5a1c2b3d4e", "kind": "error", "payload": { "code": "bad_request", "detailKey": "web.error.malformedUrl" } }
```

## 3. Enumerations (closed sets)

- `risk`: `none_observed | info | suspicious | high | unknown` (per master-plan Assessment).
- `confidence`: `low | medium | high`.
- Assessment `coverage`: **`complete | partial | unavailable` only.** `fixture_only` is harness *status* vocabulary, not an Assessment coverage value, and never appears in an Assessment.
- Error codes: `host_unavailable | unsupported_version | bad_request | unsupported_method | oversized | timeout | protocol_error`. A client-side timeout is surfaced locally and is distinguishable from a host-sent `error` frame.

## 4. Methods (v1)

| Method | Payload | Notes |
| --- | --- | --- |
| `capabilities.list` | `{}` | Returns what the host/agent can currently do; absent capabilities are listed as unavailable, never omitted. |
| `url.assess` | `{ "url": string, ≤2048 chars, http/https }` | **Local parsing/classification only — the host never visits, fetches, or resolves the supplied URL.** No analyzer available ⇒ risk `unknown`, confidence `low`, coverage `unavailable`, with explicit `skipped` checks and reasons; **never** `none_observed`. |
| `scan.report` | — | **Future proposal only.** Not a current `RpcMethod`; v1 hosts must reject it with `unsupported_method`. Documented to reserve the name; do not implement. |

No generic `execute`, no dispatch to USB, vault, quarantine, or policy operations from the browser boundary.

## 5. Versioning

- `schemaVersion` follows `sentinel-proto` major.minor semantics. The **major** must match exactly: a mismatch is answered with `unsupported_version` (echoing the request `id` only when the envelope is structurally valid) and the connection is not used further.
- **Minor** compatibility is explicit: a peer may ignore unknown minor-level payload fields but must reject unknown `kind`s with `unsupported_method`. Negotiation beyond this is not attempted in v1.

## 6. Framing safety and malformed input

- The declared byte length is checked **before any payload allocation or parse**. Truncated headers, truncated bodies, lengths over the cap, invalid UTF-8, invalid JSON, and non-ASCII length fields are rejected.
- A frame that cannot be parsed has **no trustworthy request id**; peers must not echo one. The receiving side reports a local `protocol_error` state and terminates/rejects the transport.
- Ids are echoed **only** for structurally valid envelopes.

## 7. Identity and boundaries

- Host manifest pins **exact** extension IDs in `allowed_origins` (no wildcards). The host validates the Chrome-supplied caller origin on every launch.
- The host independently authenticates to the per-user agent over the existing named-pipe boundary (SID/session binding, remote-client rejection). **A correlation `id` is correlation, never authentication**; identity fields inside messages are never trusted.
- Extension side: the current `sender.id === chrome.runtime.id` check is adequate for the popup-only harness. **Before any content script is added**, requests must additionally validate the actual sender tab/frame, origin, and document URL, and the action permitted for that context — same-extension `sender.id` alone does not establish which page caused a request.

## 8. Correlation and lifecycle

- Request ids are unique and bounded in length; the extension keeps a **bounded pending-request map**; exactly **one response per request**.
- Late, duplicate, or unsolicited replies are rejected/ignored and counted, never applied.
- On timeout (default 5 s for `url.assess`) or port disconnect: all pending observations are cleared, the agent state becomes `unavailable`, and no partial response is parsed or displayed.
- A displayed result must still match its subject and be unexpired: subject matching and expiration are checked before presenting an Assessment as current.

## 9. Privacy and diagnostics

- Full browsing URLs and query strings are **never logged by default**; diagnostics use redacted/pseudonymized forms per the master plan's sanitization rules.
- Transport/protocol errors remain separate from completed assessments in storage and UI.
- No message content is uploaded anywhere; the native path is local-only.

## 10. Acceptance tests (agreed before implementation)

1. Framing vectors: truncated header, truncated body, length = cap, length = cap + 1, invalid UTF-8, invalid JSON, non-ASCII in the length field — each rejected before parse; oversized yields `oversized`, unparseable yields `protocol_error` and transport termination.
2. `schemaVersion` major mismatch ⇒ `unsupported_version`; minor-only difference tolerated per §5.
3. `scan.report` and any unlisted kind ⇒ `unsupported_method`, no state change.
4. `url.assess` with no analyzer ⇒ `unknown`/`low`/`unavailable` with explicit skipped checks — and never a fetch/DNS lookup of the URL (asserted via mock network).
5. Echo semantics: structurally valid ⇒ `id` echoed exactly once; malformed frame ⇒ no echo.
6. Timeout and disconnect: pending map cleared, status `unavailable`, no cached verdict displayed as current.
7. Privacy: with default logging enabled, no full URL or query string appears in host or extension logs.
8. Permission guard: the manifest gains `nativeMessaging` only in the commit that implements this agreed contract, with the README permission table updated in the same change.
