# Watchtower stage 3 checkpoint

Added bounded process/PID, local-port and connection-creation metadata to existing local TCP snapshots. The behavior engine tracks distinct connections using HMAC-keyed session memory. It combines sampled regular reconnections with uncached-destination/unusual-port context. A persistent connection observed repeatedly is not counted as repeated beacons. PID/process-start context avoids merging unrelated process lifetimes where Windows makes that metadata available.

New random-looking, non-trusted hostname observations clustered in a short window can produce device-wide DNS behavior evidence. Initial cache population is not called a burst. No process attribution is inferred from DNS cache records, and uncached IPs are not asserted to be raw-IP URLs. Usual ports, window lengths, counts, variation and scores are editable config.

Four new traffic regressions passed with 19 other domain/topology/provider tests: stable connections, distinct regular reconnections, normal DNS-associated HTTPS/local destinations and initial-versus-new DNS bursts. All fixtures are invented; no live network attack or malicious connection was made. No encrypted application content is intercepted.

Limits: 30-second established-connection snapshots miss short-lived traffic. Legitimate telemetry can reconnect regularly. Cache observations do not measure DNS query volume. Per-app upload bytes and NXDOMAIN query rates are explicitly unavailable; an additional reviewed Windows tracing/counter provider would be needed. This slice does not claim either detection. Baselines and bounded event timing are memory-only and expire. Actual attack, elevated provider and hardware acceptance remain pending.
