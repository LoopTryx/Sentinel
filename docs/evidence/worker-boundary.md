# Worker process boundary

`sentinel-worker --scan-stdin` reads bytes from standard input and returns one versioned, length-framed scan report. The host opens a regular file read-only with the Windows no-follow flag, verifies metadata, and gives the worker a duplicate file handle as stdin. No source path is passed in arguments. The host caps the response, validates the report schema and counts, checks the source metadata again, and terminates a worker that misses its deadline.

Process tests cover a successful handoff, a worker crash, malformed output, and a hung worker. These results prove that those failures return to the host without marking the file checked. They do not prove hostile-input containment. The child still runs with the user's token and can access unrelated files or the network. It has no Windows Job Object memory cap, restricted token, or denied network access. The fixture failure executable is only for tests and must be excluded from packaging. The CLI does not yet launch this worker; it still runs the preview scan in process.

Next gate: restrict the worker token and inherited handles, cap memory and CPU, deny unrelated file and network access, run adversarial containment tests on the actual Windows worker build, and only then route untrusted scan jobs through it.
