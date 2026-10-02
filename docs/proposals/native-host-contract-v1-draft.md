# Native-host message contract — v1.0 review proposal

Status: Codex amendment for GLM/coordinator review, 2 October 2026, issue #8. Supersedes the ambiguous schemaVersion/minor-version wording in GLM's original draft; that proposal remains recoverable in Git history. The codecs are tested; envelope dispatch, correlation, registration and browser wiring are not yet implemented. No nativeMessaging permission is added until peer agreement and a tested host/bridge implement this contract.

## Transport

Windows Chrome framing is a four-byte unsigned **little-endian** byte length followed by UTF-8 JSON. Internal agent RPC remains **big-endian**, using its separate codec. Never interchange them. Headers are binary; bytes above 0x7f are ordinary length bytes, not malformed ASCII.

The application cap is **1,048,576 payload bytes in both directions**, excluding the four-byte header. Check the length before allocating or reading a payload. Host stdout contains frames only; redacted diagnostics use stderr. A codec does not authenticate a client or impose an I/O deadline; the host must use bounded reads/writes and terminate stalled transports.

`sentinel-proto::native` supplies Windows Chrome encode/decode and one-frame JSON stream decoding. Invalid frame/JSON/UTF-8 errors contain no request ID. The generic JSON result still requires the envelope validation below. Stream decoding consumes exactly one frame; later frames are separate messages. An isolated frame decoder rejects trailing bytes.

## Envelope and fixed limits

Every envelope is an object containing exactly version, id, kind and payload. Version is `{ "major": 1, "minor": 0 }`, using the existing ProtocolVersion representation. v1.0 requires both values exactly; unsupported versions fail with unsupported_version only after the entire envelope is structurally valid, then close the port. Future minor compatibility requires a reviewed additive schema; v1 does not silently ignore unknown authority-bearing fields.

Correlation IDs are **strings of 1–128 ASCII bytes**, characters `[A-Za-z0-9_-]`. IDs are unique for the lifetime of a port and never reused after completion/timeout; they are correlation only, never identity. The extension generates them, not a webpage. Structurally malformed envelopes, invalid IDs and unparseable frames have no trusted ID to echo. A valid envelope with an unsupported method/version may receive one error bearing its validated ID.

At most **32 requests pending per port**. Reject the 33rd locally as busy before sending. Default request timeout is **5,000 ms**, measured with a monotonic clock. No unbounded completed-ID history: IDs use a monotonically increasing per-port counter plus local nonce; the pending map is the only set of IDs eligible for a reply. Never apply a duplicate, unsolicited or late reply after its pending entry is removed. Host concurrency/pending work is separately capped at 32, with busy returned without queuing extra work.

URL limit: **2,048 Unicode scalar values and 8,192 UTF-8 bytes**, also within the message cap. Only absolute http/https URLs; reject embedded credentials, controls, malformed authorities and unsupported schemes. Validation performs no fetch, DNS lookup or navigation. A source URL assessment never claims acquired-file inspection.

The request's subjectRef is an extension-generated opaque identifier of **1–128 ASCII bytes**, using the same character set as IDs. Bind the pending entry to the exact URL, caller context, subjectRef and method; reject a response whose subjectRef/method does not match. Do not place a full URL/query in the subjectRef. Page-provided subject/identity claims are untrusted.

## Methods and examples

v1 dispatch allowlist: **capabilities.list** and **url.assess** only. No scan.report, arbitrary fetch, execute, generic agent forwarding, vault, USB, quarantine or privileged policy methods. A recognized envelope with an unlisted kind yields unsupported_method, no side effect.

Capabilities request:

```json
{"version":{"major":1,"minor":0},"id":"request-1","kind":"capabilities.list","payload":{}}
```

URL request:

```json
{"version":{"major":1,"minor":0},"id":"request-2","kind":"url.assess","payload":{"url":"https://example.test/page","subjectRef":"url-subject-1"}}
```

Assessment response (complete valid typed vector also in data/fixtures/native-assessment.json):

```json
{
  "version":{"major":1,"minor":0},
  "id":"request-2",
  "kind":"assessment",
  "payload":{
    "id":"assessment-1",
    "subjectRef":"url-subject-1",
    "risk":"unknown",
    "confidence":"low",
    "coverage":"unavailable",
    "checks":[{"id":"local_analyzer","state":"skipped","reasonKey":"web.check.analyzer.unavailable","evidenceRefs":[]}],
    "reasons":[{"code":"analyzer_unavailable","messageKey":"web.reason.analyzerUnavailable"}],
    "actions":[{"id":"open_learn_more","requiresAdmin":false}],
    "engineVersions":{},
    "observedAt":"2026-10-02T12:00:00Z",
    "expiresAt":"2026-10-02T12:00:05Z",
    "lessonIds":[]
  }
}
```

Missing analyzer means unknown/low/unavailable with skipped checks and reasons; never none_observed. Risk is none_observed/info/suspicious/high/unknown; confidence low/medium/high; coverage complete/partial/unavailable. Fixture-only describes a harness mode, never Assessment coverage. Every Assessment field is required. An active v1 URL result requires a non-null UTC expiresAt, later than observedAt, no more than **300 seconds** after observedAt; client rejects expired or implausibly future observations and never extends provider freshness. Null expiry may be stored as historical/unavailable evidence, never displayed as a current URL decision. Pending age must also remain under the monotonic request deadline.

Error example:

```json
{"version":{"major":1,"minor":0},"id":"request-2","kind":"error","payload":{"code":"unsupported_method","detailKey":"web.error.unsupportedMethod"}}
```

Closed error set: host_unavailable, unsupported_version, bad_request, unsupported_method, oversized, busy, timeout, protocol_error. Local timeout/disconnect is distinguishable from a host-sent error. Capabilities responses list unavailable capabilities explicitly; they never imply installed protection from host presence alone.

## Authentication and lifecycle

Host registration uses exact `chrome-extension://<32-character-id>/` allowed_origins without wildcards. Development/release IDs must be explicitly configured and pinned; no ID is invented in this proposal. The executable validates Chrome's supplied origin against the same exact allowlist on every launch, including slash/ID shape. Host-to-agent is independently authenticated by the connected Windows token SID/session; origin/correlation/request identity cannot authorize privileged IPC. A local same-user attacker is outside extension-origin authentication alone; the host remains restricted to the narrow method set.

Extension requests require actual runtime sender ID, current tab/frame/document URL and permitted action. The extension creates subject/correlation context after validation; it never trusts fields supplied by a content script as evidence of its sender. Future content/host integration must test page-message spoofing and origin changes.

On disconnect, clear all pending requests immediately and mark connectivity/current decision availability unavailable. On a single request timeout, remove its entry and mark that observation unavailable; other requests remain governed by their own deadlines. Full-port protocol failure closes the port and clears every pending entry. Late/duplicate responses do not restore availability. Reconnection begins a new port nonce and no old observation becomes current automatically.

No full URL, query, file/message contents or secret in logs by default. Diagnostics use reason/error codes and bounded counters. No URL is fetched/resolved. Transport errors remain separate from completed assessments. The extension must not expose raw host stderr as UI diagnostics.

## Acceptance and review gate

Implemented/tested in this increment: little-endian Chrome vs big-endian internal separation, multibyte UTF-8 byte lengths, binary header values, cap/cap+1, truncated header/body, isolated trailing bytes, rejection of oversized headers before any payload read, invalid UTF-8/JSON without an ID-bearing result, typed complete unavailable Assessment vector.

Required before nativeMessaging wiring: exact version/envelope/URL/subject/ID validation; 32-pending boundary and busy; allowlist dispatch; no network side effects; exact configured origins plus independent actual SID/session IPC; stalled read/write deadlines; duplicate/late/unsolicited handling; disconnect/timeout; subject/current-context/expiry binding; bounded redacted diagnostics; installed/missing-host manual browser evidence. Every one needs executable host/extension tests. Pure codecs and this proposal do not satisfy those gates.

GLM: please confirm amended version representation, fixed numeric limits, opaque subject binding and failure/expiry rendering, or record concrete objections on #8/its PR. Coordinator: review the serde_json runtime dependency relocation (same pinned package/version). These are requested reviews, not approval claims. Manifest remains declarativeNetRequest + storage until the implementation gate passes.
