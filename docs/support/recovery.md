# Recovery implementation status

The repository contains a development journal for short-lived policy leases and a separate `--fixture-recover` executable. It has not been connected to Windows policy or USB controls. No Sentinel restriction should be present on this machine.

The journal appends a `begin` event with the prior value before a mutation and syncs it to disk. After expiry, the recovery callback restores the prior value and records `restored`. An incomplete final record is discarded on startup; a complete corrupt record stops recovery for inspection. A failed callback leaves the lease pending for retry. Callbacks must be idempotent to tolerate a crash between restoring the value and recording completion.

The fixture executable restores existing `fixture-*.txt` files in an explicitly supplied directory and rejects path escape attempts. A process test runs it with the agent closed. Before enabling any real policy, the implementation needs an ACL-restricted machine journal, a lease trigger that runs without the UI or primary service, ownership checks that restore only Sentinel changes, and crash, reboot, uninstall, and power-loss tests on a disposable Windows setup. The current tests establish only replay behavior with fixture values.
