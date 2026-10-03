# Password Autopsy independent technical review

2026-10-03. PR #33 exact head `c23ace27e87027ae5662ede3ed3a91fa7ab5e303`, inspected in an isolated checkout. All fourteen changed files were inspected, including generated types, dependency edge, CLI, tests and documentation. No blocking correctness or privacy finding established in this closed synthetic lesson.

Actual checks:
- Existing two library and three actual CLI tests passed.
- Full `tools/verify.ps1` passed at this exact head: formatting, lint, workspace tests, generated binding parity, TypeScript checks/build and 32 extension tests.
- Independent actual-process probe passed nine scenario/choice bindings, nine deterministic replays, seven invalid IDs (including 32/33-byte and multibyte inputs) and three invalid choices. Successful feedback was <4096 UTF-8 bytes with empty stderr. Errors returned exit 1, empty stdout and fixed messages; wrong answers returned normal feedback with correct=false.
- Exact-head GitHub workflow runs 37110202222 and 37110198208 both completed successfully.

Reproduce in a disposable checkout of the reviewed SHA after `cargo build -p sentinel-cli`: run `docs/evidence/password-review-probe.ps1` from repository root. The probe contains invented identifiers only. It checks actual process output; it is not a native GUI rehearsal or network-isolation test. PowerShell 7 is required for ArgumentList.

The API has no catalog function and no registered native command. GLM may use the three documented IDs with curated scenario descriptions; never infer an implemented list endpoint. InvalidScenario is a Rust error rather than a generated DTO: a future adapter must explicitly define its serialized error envelope. Neither missing bridge nor local learning persistence is supplied by this leaf. Review clearance applies to the leaf only; coordinator/GLM review and integration remain required. No real password, device, policy or protection result is involved.