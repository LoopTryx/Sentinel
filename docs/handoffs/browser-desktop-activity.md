# Browser desktop landing surface — issue #8

Owner direction: desktop is the home for browser harness activity. One navigation/assessment identity follows warning, popup and desktop detail; local explanation stays available without provider access. Desktop owns history, capability/settings and vault surface; extension handles context-specific alert and explicit actions. Both show the same measured outcome and limitations. GLM owns styling and UI adapters.

## Implemented native inbox prerequisite

Authoritative Rust DTOs: sentinel-proto/src/browser_activity.rs; generated TS BrowserActivityEvent/BrowserActivityKind. Fields: sessionRef, sequence (u32), navigationRef, assessmentRef, kind. Fixed kinds navigation_held, potentially_harmful, inspection_unavailable, continued_once, dismissed. No URL/message/password/raw file/error text field. Events are partial evidence, not a risk verdict or safety promise.

```json
{"sessionRef":"session-1","sequence":1,"navigationRef":"nav-1","assessmentRef":"assessment-1","kind":"navigation_held"}
```

Native API: BrowserActivityInbox::new(&str) -> Result<Self,ActivityError>; accept(BrowserActivityEvent) -> Result<bool,ActivityError>; events() -> oldest-first iterator; omitted() -> u32. One inbox per authenticated paired browser session. References must be 1–64 ASCII alphanumeric/_/-; sequence positive, strictly increasing and never wrapped. new/accept reject invalid evidence, wrong_session or replay with fixed enum errors, no content echo. True means recorded in this in-memory inbox, not persisted or displayed by GUI. False means exact duplicate of latest event; changed same-sequence or older events rejected. Outbox reconnect must retry oldest unacknowledged event in order, not send arbitrary history after newer events.

Retains 128 events, evicts oldest and counts omissions explicitly. Retains last accepted sequence/event beyond eviction to reject stale replay. At u32 sequence maximum, establish fresh authenticated session; no reuse of IDs or silent reset. Omitted counter cannot exceed the admitted positive sequence range. No durable restart evidence: new inbox requires fresh trusted session ID and should not accept stale previous connection events. Host must bound the number of inboxes and retire them on connection/session replacement; this instance bound is not global admission.

## Connectivity integration contract still required

DTO sessionRef is correlation, not authentication. Only reviewed exact-origin Chrome native host, authenticated per-user IPC, supported method and sender/tab/frame/navigation binding may call accept. A page cannot choose session or submit activity directly. Validate frame byte cap before decode; deny_unknown_fields prevents private payload fields, but reference bounds are enforced by accept. No new native v1 RPC method/permission/service listener is enabled here. Native v1 remains capabilities.list/url.assess until coordinator integrates approved protocol extension.

Desktop adapter maps fixed event kinds to local static text and subject-bound detail actions. Resolve only a retained approved assessment matching BOTH navigationRef and assessmentRef; missing/expired assessment disables detail and shows unavailable, never loads arbitrary URL/files. Do not construct a clean/connected shield from an inbox row. Native receipt timestamp is assigned by host, not page; timestamp and desktop DTO wrapper need authoritative contract before UI wiring. No invented threat count from fixtures.

Desired connection states: disconnected, connecting, connected, degraded. Connected requires successful authenticated handshake and current capability response, not a socket's existence. Show desktop unavailable in popup; preserve local explanations. Bounded redacted browser outbox needs explicit pending/ack/retry/overflow/cancel semantics, and desktop native receipt acknowledgement after ingest. Existing inbox is not that transport/outbox. Provider actions, vault secrets and privileged actions cannot pass through generic activity endpoints.

## Acceptance / next

cargo test -p sentinel-agent --test browser_activity and cargo test -p sentinel-proto --lib. Synthetic tests cover reconnect duplicate, conflicting replay, foreign session, invalid/private reference, 130 accepted events retaining128/omitted2 and replay beyond retention. Full verifier after committed generated bindings. No real extension-desktop connection or manual UI journey claimed.

Next: reviewed native event envelope/authority and paired session lifecycle, transport/outbox/ack, desktop runtime adapter and GLM subject-bound landing UI. Verify actual controlled benign browser warning appears once in desktop and opens identical explanation; disconnect/reconnect/offline/restart/cross-tab/expired-result tests. Keep original native-host review gates and expanded S1 plan.
