# Watchtower stage 2 checkpoint

Implemented passive, bounded English netsh BSSID/authentication/channel/signal parsing, cached gateway/neighbor observations, DNS configuration and hosts/proxy hashes. No ARP packets, Wi-Fi scans, probes or remote-device commands are issued. Windows may restrict nearby-network output through location/permission controls.

The engine keeps bounded HMAC-keyed session baselines. New BSSIDs/channels alone do not flag a network. Previously observed WPA2/WPA3 names advertising new open identities combine evidence. Gateway MAC, DNS, hosts/proxy and shared-neighbor-MAC observations combine conservatively. Roaming, bridges, DHCP, updates and user edits can explain these signs. Baselines reset on restart/expiry and are not approved trust or complete persistent Wi-Fi history.

Optional browser sharing now includes only the presence of password or autocomplete card-number fields at main-frame load. It requires explicit site/scripting permission; no form values, labels, page text or private tabs are read or transmitted. Limited Windows connectivity plus sensitive-field presence can produce a possible portal warning. Ordinary login/checkout on an Internet-connected network does not. This cannot confirm a captive portal or see every dynamic form.

Seven topology regressions and recorded/invented English netsh parser fixtures passed, plus six opt-in/provider/transport regressions. Tests cover legitimate roaming, changed open identity, signal/shared-MAC ambiguity, combined persistent changes, network/interface separation, portal context and expired/unavailable baselines. No network attack was performed. Actual passive collection reported topology and Wi-Fi available with 10 bounded nearby entries; only aggregate counts entered tool output. User-specific names/addresses were not logged.

Weights, minimum observations, signal difference and thresholds are in watchtower-config.json. No network blocking is added by this stage. Actual attack/hardware acceptance and independent review remain pending.
