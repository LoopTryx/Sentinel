# Protection goals and evidence gaps

This is a development/acceptance record, not a superiority claim. Adding settings or a signature count does not establish better malware protection.

| Capability | Sentinel evidence now | Remaining work before parity/superiority claim |
|---|---|---|
| Quick, full, file/folder scans | Owned native signature worker; scan/cancel/priority acceptance | Complete-drive coverage/performance measurements across machines |
| Larger file handling | 1 GiB configured; 300 MiB harmless and boundary qualifications recorded separately | Encrypted archives, archive bombs and constrained-memory lab corpus |
| Automatic completed Downloads checks | Watcher stability/rename/overflow reconciliation | Pre-execution interception; signed service/minifilter architecture |
| Quarantine/recovery | Immutable verdict/hash subject; encrypted local store; owner-confirmed restore; 64 MiB payload/512 MiB quota | Cross-crash/low-disk qualification on disposable systems beyond existing automated suite |
| Updated intelligence | Official signed ClamAV databases, periodic idle refresh | Comparative coverage/false-positive testing; curated additional intelligence with provenance |
| Behavioral/ransomware blocking | Not implemented | Trustworthy process/file correlation, prevention boundary, false-positive and rollback tests |
| Boot/offline protection | Not implemented | Recovery environment and independently qualified signed boot components |
| Tamper-resistant service | Not implemented | Protected service/ELAM certificate and Windows signing/qualification process |
| Cloud-delivered unknown-file analysis | Not implemented | Explicit privacy contract, secure backend, controlled submissions, measured response times |
| Browser awareness / owner-approved USB workflow | Separate existing Sentinel features | Their individual installed/hardware acceptance; these do not prove AV detection superiority |

## Appropriate benchmark
A properly isolated, licensed malware lab and benign software corpus, matching definitions/dates/OS settings, repeated trials, independent review, and no Defender weakening. Compare detection and prevention rates, false positives, time to containment, recovery success, CPU/RAM, scan latency and update reliability. Ordinary harmless fixtures verify software plumbing, not malware-detection accuracy. No live malware/EICAR on the daily-use laptop.

## Microsoft integration prerequisites
- File-system minifilters are the supported driver architecture for scanning creation/access/modification: https://learn.microsoft.com/en-us/windows-hardware/drivers/ifs/about-file-system-filter-drivers
- Protected antimalware services have ELAM/certificate requirements: https://learn.microsoft.com/en-us/windows/win32/services/protecting-anti-malware-services-
- Driver signing overview: https://learn.microsoft.com/en-us/windows-hardware/drivers/install/windows-driver-signing-tutorial
- Defender controlled-folder access is a separate ransomware prevention capability: https://learn.microsoft.com/en-us/defender-endpoint/controlled-folders

No unsigned/test-signing bypass, speculative privileged driver or fake protection toggle is installed. These capabilities remain real engineering/signing/lab prerequisites, rather than UI-only claims.
