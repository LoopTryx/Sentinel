# Signed approval components and native connection notices

## Current behavior

The desktop console registers the Windows USB device-interface notification class. A new physical parent produces a native navy/azure notification with reported name and observed keyboard/mouse capabilities where available. Composite interfaces are deduplicated. Removal invalidates late metadata results and marks an existing notice disconnected; it does not approve another connection. Internal-port candidates suppress this user-session notice only; that is not enrollment or a protection decision.

The actual admission service is not installed or implemented by this increment. Popups therefore show **Input blocking unavailable**, disable Allow once, and offer Dismiss. There is no blocked/approval-enabled model factory. Closing a popup never grants input. A post-arrival event is not pre-input protection. The console is rebuilt locally; this is not a release/install or main code integration.

## Native integration signatures

`UsbGuardAuthority(byte[] protectedEnrolledPublicKey)` creates a service-internal RSA public-key verifier. It accepts a public CAPI blob of2048–4096 bits; it neither enrolls keys nor establishes caller identity. The separate clock constructor is for trusted native tests, never IPC.

`BindNativeCaller(ownerSid, installedImageHash, processId, sessionId) -> Caller` must be called only after actual OS pipe identity and installed-image verification. That authentication adapter is not yet implemented. Caller objects and connections are private authority references, not wire DTOs. No renderer-supplied SID, PID, hash or authorization assertion is accepted by an installed endpoint; no endpoint exists yet.

`Attach(nativeSubject, capabilities) -> Connection` generates a new connection generation, replacing prior challenges. `Detach(connection)` invalidates it. Maximum64 current connections; bounded strings; no raw subject in challenge payloads or reports.

`Issue(connection, AllowOnce|Enroll, caller) -> Challenge` binds a fresh random nonce, service-run nonce, hashed native subject/capabilities, connection generation, caller binding, operation and monotonic60-second expiry. `Challenge.Payload` returns a defensive copy.

`VerifyAndConsume(challenge, signature, connection, operation, caller) -> bool` verifies RSA/SHA256 against the pinned public key only after exact references/action/freshness checks. Proof attempts consume the pending challenge; replay, expiry, detach/reconnect, altered caller/action, replaced challenge and clock rollback fail closed. A true result is signature authority only, not successful native admission; the broker must still revalidate the connection and perform/verify its platform action. No broker currently calls this component.

Example native test flow: create an in-memory synthetic2048-bit key; construct authority from its public blob; bind a synthetic caller; attach a synthetic subject; issue AllowOnce; sign its copied payload; verify once; repeat verification fails. This test establishes protocol behavior, not genuine Windows Hello, enrollment, caller authentication or device containment.

`UsbHelloSignature.SignExisting(nativeForegroundWindow, servicePayload) -> Task<Result>` opens the existing per-app owner credential alias and asks KeyCredential to sign. It never creates/replaces a key or returns an approval Boolean. Results: signed (bounded CAPI public key/signature), cancelled, unavailable. Window must belong to the current process and be foreground; payload<=1024bytes; one pending operation; cancellation/timeout remains unavailable and holds prompt serialization until terminal completion. The broker must reject a returned public key that differs from protected enrollment. Existing-key signing was not exercised; no owner key was created or exported.

Reflection smoke verifies the actual `Windows.Security.Cryptography.Core.CryptographicPublicKeyBlobType` type and KeyCredential RetrievePublicKey overload on this host. Independent review caught a wrong namespace; regression failed before correction and passes afterward. Public buffers are bounded before conversion. [Microsoft API](https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.keycredential.retrievepublickey).

## Notification state and limits

`UsbGuardArrival(window, nativeHandle)` receives USB interface arrival/removal notifications, privately resolves a physical parent and dispatches `UsbGuardPopup`. Native interface buffers30–4096bytes; at most128 interface mappings/64 live parent references/four metadata queries/four popups. Excess arrivals may be omitted; there is no retry yet. Synchronous OS queries run off the UI thread but have no hard cancellation deadline. This is a bounded user-session notification component, not the privileged admission/watchdog path.

`UsbGuardNotice.Unavailable(reference,name,capabilities,reason)` is an immutable native presentation object with sanitized bounded reported text and disabled approval. `UsbGuardPopup` is a taskbar-hidden, non-focus-stealing native WPF window. Names are device-reported metadata, never authenticity evidence. Dismiss and disconnect do not change policy.

## Evidence and reproducible checks

`tools/test-usb-guard-authority.ps1`: PASS for synthetic signed proof, defensive payload copies/redaction, replay, wrong caller/action, reconnect, expiry, signature corruption, superseded proof, clock rollback and capacity. No native owner credential.

`tools/test-usb-hello-signature.ps1`: PASS for payload/window refusal, cancelled/invalid proof redaction, namespace regression and actual reflection projection availability. No enrollment or live signing.

`tools/test-usb-guard-popup.ps1`: PASS for sanitized text, unavailable state, disabled approval and reference redaction. `tools/test-usb-guard-arrival.ps1`: PASS for deduplication, reconnect generation, late-result invalidation, capacity, clear and buffer bounds.

Controlled hardware notification: owner reconnected a normal receiver with Ducky absent. First observation reported no popup and recorded zero arrivals; no root cause is asserted. Second bounded native observation recorded one arrival and one popup; owner explicitly confirmed seeing the card with receiver name and unavailable status. [Sanitized captured counters](evidence/usb-arrival-popup-2026-10-14.json) record registration, timestamp, counts, no policy change and blocking inactive. This proves that notification journey only. No key contents, interface paths, serials, typed input or coordinates were recorded.

Desktop/recovery binary build PASS; complete repository verifier and independent review recorded in issue12/PR74. Printed manual browser acceptance instructions were not executed by this USB work.

## Remaining work

Installed authenticated SYSTEM service/IPC, protected owner enrollment and actual key-signing acceptance, independent installed watchdog, first-install recovery provisioning, authenticated baseline enrollment and qualified native admission remain unfinished. Source correlation is resolved on this laptop. The owner deferred recovery/fallback verification and requested continued code tests. Phase0 first-input/firmware and recovery acceptance must still run before any active protection claim or release. No live input restriction, device disable, driver installation, watchdog install, Defender change or E: access occurred.
