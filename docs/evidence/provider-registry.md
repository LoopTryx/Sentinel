# Provider registry (working)

## URLhaus community feed

- Purpose: malware URL indicators only. A URL missing from this feed is not evidence that it is safe or free of phishing.
- Format: the [official API documentation](https://urlhaus.abuse.ch/api/) describes a plain-text list with one URL per line. Fixture parsing and exact offline lookup are implemented; live downloads have not been tested.
- Access: the provider requires an Auth-Key for downloads. The community API is subject to fair-use principles; commercial use may need a separate subscription. CyberShield currently has no key and makes no request.
- Validation: cap feed bytes, URL length, and entry count; require HTTP(S) URLs with hosts and no credentials or fragments; deduplicate and retain retrieved/expiry times. Cache digests detect accidental corruption but do not authenticate provider data. No feed signature is documented for this format, so transport and key handling must be reviewed before activation from the network.
- Consent: `provider_requests_enabled` defaults to false. A per-provider opt-in control and a bounded download adapter are required before any live use.
- Update cadence: the provider says its dumps are generated every five minutes and asks clients not to fetch more often than every five minutes. The eventual downloader must enforce a longer minimum interval and bounded retries.
- Scope: this parser has been tested only with benign `.test` fixture URLs. It must not fetch or visit listed URLs.
