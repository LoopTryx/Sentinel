# Release numbering and provenance

The owner normalized Sentinel's preview numbering on 2026-10-30. The current application is **v1.0.0**.

| Previous label | New label | Provenance |
|---|---|---|
| v1.0.0 | v0.1.0 | Original portable school-demo commit and release assets |
| v2.0.0 | v0.2.0 | Original installer-preview commit and release assets |
| v3.0.0 | v0.3.0 | Original integrated preview Git tag; source remains available |
| Local v4 | v0.4.0 | Documented local development milestone; no independent source tag or retained original installer |
| Local v5 | v0.5.0 | Documented local development milestone; no independent source tag or retained original installer |
| Local v6.0.0 and subsequent fixes | v1.0.0 | Consolidated current source and rebuilt single installer |

Published Git commit history is not rewritten or backdated. Old release/tag identities are archived before conflicting names are reassigned. Historical artifacts are retained byte-for-byte where available; embedded legacy version text is not retroactively patched. New checksums refer to the actual downloadable filenames.

The absence of a historical installer is documented rather than replaced with today's application under an old version number. Current source archives come from the current release commit; GitHub's automatic historical source archives come from the corresponding original tags.

## Branch retirement

Retire only branches whose complete tip is an ancestor of consolidated main, after recording a recoverable archive tag and resolving any associated pull request. Unique unintegrated work and checked-out local branches remain intact. An ancestor check establishes integration of commits, not test coverage or security approval.
