# Changelog

Versions follow semantic versioning. Historical preview numbers were normalized on 2026-10-30; original commits, authors and development dates are preserved. See [version migration](docs/releases/version-migration.md).

## [1.0.0] - 2026-10-30

### Added
- Persistent encrypted password vault with Windows Hello approval for sensitive operations, metadata browsing, browser account tools, autofill/save flows and a shared console/extension generator interface.
- Native CPU, memory, Chrome working-set and drive-capacity overview, with explicit unavailable states.
- Persistent signature-scanning worker, download monitoring, manual scan modes, cancellation and signature-runtime integrity validation.
- Local AI chat context and encrypted conversation history that survives application restarts.
- Gmail, Outlook and WhatsApp message-awareness adapters, local explanations and desktop consultation handoffs.
- A single Windows setup executable with payload verification and prerequisite guidance.

### Changed
- Consolidated the accumulated desktop, Rust, backend and browser-companion source into the authoritative repository.
- Improved glass presentation, responsive layouts, password workflows and installer sizing.
- Made AI handoff delivery wait for an acknowledged interface receiver instead of consuming requests during startup.
- Updated documentation, source hygiene and release versioning. Build caches, browser profiles, owner credentials and conversations are excluded.

### Known limitations
- Live browser layouts, Windows Hello and device-policy behavior require testing on the target computer; code tests do not establish universal compatibility.
- USB/HID policy and driver experiments are not universal BadUSB protection. Keep experimental enforcement disabled on daily-use computers.
- A clean scan means no indicator was detected in the inspected scope; it is not proof of safety. Keep Microsoft Defender enabled.
- The Windows installer is not claimed to be Authenticode-signed. Compare release checksums and review the source.

## [0.5.0] - Historical local milestone

Installer and password/browser workflow iteration, originally called v5. No independent Git tag or retained original binary package was found during release consolidation. This is a development milestone, not a reproducible historical download.

## [0.4.0] - Historical local milestone

Native scanning, local overview and installer iteration, originally called v4. No independent Git tag or retained original binary package was found during release consolidation.

## [0.3.0] - Historical preview

Originally v3.0.0: integrated console, local AI and USB Guard preview. Preserve preview capability limits and the original tagged source; later changes belong to 1.0.0.

## [0.2.0] - 2026-10-13

Originally v2.0.0: desktop installer, native USB observations and connected extension preview. Historical binaries retain their original embedded version labels.

## [0.1.0] - 2026-10-06

Originally v1.0.0: portable school demo, connected glass console, selected-file inspection and invented account workspace. These dummy-account capabilities must not be confused with the current encrypted vault.
