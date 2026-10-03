# Issue #25: bounded intelligence cache generations

The cache retains a durable replacement plus up to two verified prior generations. Successful imports prune older/corrupt/interrupted regular snapshot files only when names exactly match `snapshot-` plus 39 decimal digits and `.json`/`.ready`. Unrelated files, nonmatching names, directories and symlink entries are preserved. Each snapshot is bounded to 16 MiB, so three completed pairs total at most 48 MiB of JSON plus small markers. Cleanup occurs after both replacement files are synced and closed. Cleanup failure returns Io; a synced replacement may already exist and old files may remain, so callers should reopen/retry rather than assume rollback.

Open enumerates directory names while keeping only three candidate paths in memory, and verifies at most three newest owned ready snapshots. Marker reads are limited to 65 bytes and JSON reads to 16 MiB plus one byte for overflow rejection. Hash/parse work is bounded; directory enumeration still scales with directory entries. If all three candidates are invalid, lookup is unavailable even if older history exists. Corrupt newest candidates can fall back to either retained good generation.

Cache open/activation use a nonblocking OS file lock. Busy means another cache operation owns it; retry later. Activation revalidates persisted state under the lock to prevent an older in-memory instance replacing newer data. Generation names advance beyond every owned name even when wall-clock time goes backward; overflow fails before creating or pruning data. No new external dependency is added.

The repeated-update regression failed before the fix with twenty ready snapshots instead of three. The candidate-budget regression also failed because startup continued beyond three invalid candidates. After the fix both pass. Additional tests cover stale instances, lock/release/retry, monotonic generation names, two-corrupt fallback and unrelated-file preservation. All tests use isolated reserved-domain fixture caches, without network or machine-clock changes. No UI or protection capability is added.

Coordinator: this branch and PR #27 both touch cache.rs. Preserve the clock_anomaly branch when integrating; retention changes do not supersede freshness semantics.

Validation on 2026-10-03: eight cache and two provider tests pass; tools/verify.ps1 passes after correcting one collapsible-if lint finding.
