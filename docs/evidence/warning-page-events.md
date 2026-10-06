# Warning-page desktop events — issue 14

Candidate after v1.0.0; not integrated or installed-browser accepted.

An exact installed warning.html sender can report event only. Top-level frameId 0 is required; iframe and unknown frame IDs are refused. popup keeps its existing dummy account operations; xray remains event-only. The warning bootstrap also checks window.top===window.

Payload is suspicious plus one bounded reason code (risk_list or reward_payment). No original destination, tab metadata, message, contact or password is sent. Pairing is session-scoped; disconnected reporting is best effort and never causes cloud fallback. This describes a displayed warning, not verified navigation blocking. Refreshes can yield repeated entries within the runtime's existing 64-event bound.

Evidence: failing-first real loopback transport regression reproduced warning sender rejection; review reproduced iframe event pollution, then a failing-first sender-frame test reproduced it and passed after the top-frame guard. Full tools/verify.ps1 rerun. No actual installed Chrome logging acceptance claimed.

GLM next: bind explicit delivery feedback to the paired event response without exposing raw destinations. Acceptance: paired installed extension, harmless keyword URL Enter, reason-only event visible in desktop; iframe warning emits nothing; disconnect/pause is honest. Coordinator review before integration; v1.0.0 tag stays unchanged. Broader vault/download/cloud/rehearsal scope remains pending.

Scheduled follow-up: three executable VM regressions run the actual warning bootstrap for top-level reason-only payloads, iframe/unrecognized-fragment exclusion and disconnected single-attempt behavior. Focused bootstrap/transport checks 4/4 and full verifier pass. These are controlled source tests, not installed Chrome acceptance. Both CI runs on a1302d4 succeeded; coordinator/GLM review and installed acceptance remain pending.
