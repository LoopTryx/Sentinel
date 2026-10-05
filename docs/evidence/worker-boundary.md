# Worker process boundary

`sentinel-worker --scan-stdin` reads bytes from standard input and returns one versioned, length-framed scan report. The host opens a regular file read-only with the Windows no-follow flag, verifies metadata, and gives the worker a duplicate file handle as stdin. No source path is passed in arguments. The host caps the response, validates the report schema and counts, checks the source metadata again, and terminates a worker that misses its deadline.

Process tests cover a successful handoff, a worker crash, malformed output, and a hung worker. These results prove that those failures return to the host without marking the file checked. They do not prove hostile-input containment. The child still runs with the user's token and can access unrelated files or the network. The Windows launcher now atomically assigns a one-process, 256 MiB, kill-on-close Job Object and an exact inherited-handle list. Restricted token and denied network access remain open. The fixture failure executable is only for tests and must be excluded from packaging. The CLI does not yet launch this worker; it still runs the preview scan in process.

Next gate: restrict the worker token, cap CPU, deny unrelated file and network access, run adversarial containment tests on the actual Windows worker build, and only then route untrusted scan jobs through it.

Issue #7 now drains bounded Windows stdout while the process runs, rejecting oversized headers/trailing frames and retaining the deadline through exit/EOF. Six process tests and the full verifier pass. See [output evidence and remaining gates](worker-output.md). This does not add containment or live job dispatch.

See [Windows resource boundary evidence](worker-resources.md) for the later resource/handle increment and nine client tests.
