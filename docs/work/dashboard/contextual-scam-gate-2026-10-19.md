# Contextual scam warning gate — 2026-10-19

Installed extension 0.2.21. Candidate vocabulary already contained over 100 phrases. WhatsApp and email route candidates through local model review with up to three visible redacted prior-message excerpts (300 characters each). Gmail retains its existing visible-thread scope; Outlook adds history only within an identifiable data-conversation-id container; unavailable context stays empty. No inbox scraping or contact-age inference.

Email rule-only banner/linkguard now waits for likely local verdict. Subject keywords also trigger review. Candidate-only cards require explicit likely, including when model output omits verdict. Existing backend publishQuick queues notification/handoff only for likely; trusted finding retains message_context for native NVIDIA conversation. Local classification explicitly forbids inferring fraud/new contact from absent history. Existing per-site opt-in, redaction, secret boundaries and native provider settings preserved.

Tests: extension 156 PASS; local-AI/handoff 11 PASS; extension build PASS. New email-gate test reproduced early rule warning before fix; likely/unlikely/uncertain and absent-verdict paths covered. Independent read-only review found no P1/P2 blockers. Installed email-runtime hash matches built source. Backup receipt artifacts/scam-context-installed.json.

Remaining acceptance: Chrome extension reload and WhatsApp/Gmail/Outlook refresh; actual site DOM coverage, actual local-model classification accuracy, notification delivery and NVIDIA analysis for this version have not been live-verified. Unit tests do not prove no false positives or universal email support. Missing history does not establish a new contact or a scam.
