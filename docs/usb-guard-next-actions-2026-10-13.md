# USB Guard cleanup and remaining storage work

Owner request: remove the manual USB file/folder checker, correct the Windows
interface count, inspect storage belonging to a HID device automatically, and
report quarantine progress.

Delivered UI increment: manual selection/cancel/shared-scan controls removed
from USB Guard. Verified USB input/storage groups are listed separately from
hubs, other interfaces and unresolved ancestry. Numbers explicitly describe
Windows groups, never physical/external devices. Internal versus external
placement is not established by the current collector. Composite HID/storage
groups are identified only when Windows reports both in the same group.

Automatic composite-storage inspection remains unimplemented. The collector
has no trusted mounted-volume binding; its ephemeral `device-N` label must
never authorize a scan. Do not treat generic interface detection as inspection.
Automatic inspection of unknown USB contents also requires the original hostile
parser/worker containment gate. The current Node native worker launcher provides
process separation and bounds, not a restricted token, network denial or a
complete OS containment boundary. That gate and independent review must be met
before this candidate automatically parses unfamiliar attached storage.

Next runtime increment must privately resolve USB ancestry/container to physical
disk and mounted volume; exclude E: and unknown/ambiguous mappings; bind a stable
connection generation plus volume identity before acquiring bytes; refuse
replacement/reparse/unmounted targets; and keep raw identifiers/paths out of
browser/UI reports. Use the existing bounded native worker, one job at a time,
with cancellation, timeout, skipped/partial/error states. Publish canonical
typed reports and mapping/change/error regressions for independent review before
activating the adapter. Validate the controlled benign composite device journey
without representing storage inspection as HID prevention.

Quarantine status from current source: USB hold/recovery controller and exclusive
rollback journal exist with tests, but no production Windows provider/private
handle provisioning/watchdog or verified device enforcement is connected.
File-quarantine requests remain refused by the native console with
`quarantine_recovery_lifetime_unavailable`; durable restore across runtime/worker
expiry or crash is still required. Storage hold and encrypted file quarantine
are distinct. No whole-device or file quarantine has been activated by this UI.

UI tests: 24 passed; production build passed. Four focused USB Guard regressions
cover picker removal, group counts, composite/non-scan states, failed refresh
and injected-identity/authority rejection. Full verification output is recorded
locally under artifacts/usb-guard-cleanup-verification.log.
