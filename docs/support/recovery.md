# Recovery implementation status

The repository contains a development journal for short-lived policy leases. It has not been connected to Windows policy or USB controls. No CyberShield restriction should be present on this machine.

The journal appends a `begin` event with the prior value before a mutation and syncs it to disk. After expiry, the recovery callback restores the prior value and records `restored`. An incomplete final record is discarded on startup; a complete corrupt record stops recovery for inspection. A failed callback leaves the lease pending for retry. Callbacks must be idempotent to tolerate a crash between restoring the value and recording completion.

Before enabling any real policy, the implementation needs an ACL-restricted machine journal, a separate recovery executable and lease trigger that run without the UI or primary service, ownership checks that restore only CyberShield changes, and crash, reboot, uninstall, and power-loss tests on a disposable Windows setup. The current journal tests establish only the file format and replay behavior with fixture values.
