# Password Autopsy logic evidence

2026-10-03, issue #14, branch codex/issue-14-password-autopsy. Three CLI tests were added before implementation: two valid/feedback tests failed because the command did not exist; invalid-input rejection already passed through the usage path. All three now pass. Two library tests check the full three-case/three-choice matrix and reject arbitrary/oversized ASCII/multibyte IDs.

Only curated synthetic scenario IDs and closed choices are accepted. This is educational feedback, not a real credential checker or vault. No network, real password, breach query, crack-time model, installed protection, desktop wiring, or rehearsal completion is claimed. Generated types derive from Rust; no external package/version added (internal intel-to-proto edge only). See docs/handoffs/password-autopsy.md for GLM integration.
