export const en = {
  // App frame
  'app.title': 'Sentinel',
  'app.tagline': 'Evidence-first security companion',
  'app.fixture': 'Fixture preview',
  'app.live': 'Live',
  'app.skipToContent': 'Skip to dashboard',

  // Fixture banner — always visible in fixture mode
  'fixture.banner': 'Fixture preview — no live protection is installed',
  'fixture.detail':
    'Every reading on this screen comes from a built-in demonstration dataset, not from this device. It exists to rehearse the interface while the local security agent is being built.',

  // Navigation
  'nav.group.monitor': 'Monitor',
  'nav.group.investigate': 'Investigate',
  'nav.group.learn': 'Learn',
  'nav.group.system': 'System',
  'nav.dashboard': 'Dashboard',
  'nav.scan': 'Scan center',
  'nav.usb': 'USB autopsy',
  'nav.wifi': 'Wi-Fi guard',
  'nav.web': 'Web & links',
  'nav.academy': 'Academy',
  'nav.activity': 'Activity',
  'nav.settings': 'Settings',

  // Status rail (bottom of sidebar)
  'rail.mode': 'Mode',
  'rail.connection': 'Connection',
  'rail.risk': 'Latest risk',
  'rail.coverage': 'Coverage',
  'rail.freshness': 'Freshness',
  'rail.mode.fixture': 'Fixture',
  'rail.mode.live': 'Live',
  'rail.connection.fixture': 'Demonstration data',
  'rail.connection.connecting': 'Connecting to local agent…',
  'rail.connection.live': 'Connected to local agent',
  'rail.connection.unavailable': 'Local agent unavailable',

  // Dashboard
  'dashboard.heading': 'Dashboard',
  'dashboard.hero.tone.ok': 'Completed checks found nothing',
  'dashboard.hero.tone.info': 'New information to review',
  'dashboard.hero.tone.warn': 'Suspicious signal detected',
  'dashboard.hero.tone.danger': 'High-risk finding',
  'dashboard.hero.tone.unknown': 'Protection state is not known',
  'dashboard.hero.ok.detail':
    'Every check that ran finished without a finding. This covers only the checks listed below — it is not a promise that this device is safe.',
  'dashboard.hero.warn.detail': 'A check reported a suspicious signal. Open the assessment to see the evidence.',
  'dashboard.hero.danger.detail': 'A check reported a high-risk finding. Open the assessment for evidence and safe next steps.',
  'dashboard.hero.unknown.detail':
    'No current trustworthy reading exists, so Sentinel is not claiming protection. The tiles below show exactly what is missing.',
  'dashboard.reviewAssessment': 'Review evidence',
  'dashboard.nextAction': 'Suggested next step',
  'dashboard.capabilities': 'Capability coverage',
  'dashboard.capabilities.summary': '{proven} of {total} capabilities verified',
  'dashboard.capabilities.neverChecked': 'Never checked on this device',
  'dashboard.capabilities.observedAt': 'Observed {time}',
  'dashboard.attention': 'Needs attention',
  'dashboard.attention.empty': 'Nothing needs attention right now.',
  'dashboard.activity': 'Activity',
  'dashboard.activity.job': 'Scan job {id}',
  'dashboard.activity.fixture': 'Fixture job — not running on this device',

  // Assessment vocabulary (risk / coverage / freshness are separate axes)
  'assessment.heading': 'Latest assessment',
  'assessment.unknown': 'Unknown',
  'assessment.noneObserved': 'No threats found in completed checks',
  'assessment.info': 'Information',
  'assessment.suspicious': 'Suspicious',
  'assessment.high': 'High risk',
  'assessment.unavailable': 'Checks unavailable',
  'assessment.coverage.complete': 'Complete',
  'assessment.coverage.partial': 'Partial',
  'assessment.coverage.unavailable': 'Unavailable',
  'assessment.coverage.detail.complete': 'All planned checks finished.',
  'assessment.coverage.detail.partial': 'Some checks did not finish. A partial result is not a clean result.',
  'assessment.coverage.detail.unavailable': 'No checks could run. Nothing was verified.',
  'assessment.freshness.current': 'Current',
  'assessment.freshness.stale': 'Stale',
  'assessment.freshness.expired': 'Expired',
  'assessment.freshness.unknown': 'No reading yet',
  'assessment.confidence.low': 'Low confidence',
  'assessment.confidence.medium': 'Medium confidence',
  'assessment.confidence.high': 'High confidence',
  'assessment.reason.not_assessed': 'This subject has not been assessed.',
  'assessment.reason.clean_checks': 'Every check that ran on this subject finished without a finding.',
  'assessment.reason.signature_match': 'The content matches a recognized test-signature entry.',
  'assessment.reason.heuristic_pattern': 'Content resembles a common intrusion pattern.',
  'assessment.reason.partial_coverage': 'Some planned checks did not finish, so this reading is incomplete.',
  'assessment.check.unavailable': 'The check could not run.',
  'assessment.check.passed': 'Finished with no finding.',
  'assessment.check.finding': 'Produced a finding.',
  'assessment.check.skipped': 'Was skipped.',
  'assessment.check.error': 'Failed with an error.',
  'check.hash_lookup': 'Known-bad hash lookup',
  'check.eicar_scan': 'EICAR test-string scan',
  'check.heuristics': 'Heuristic pattern analysis',
  'check.archive_walk': 'Archive inspection',
  'check.availability': 'Check availability',

  // Capabilities
  'capabilities.heading': 'Capability coverage',
  'capability.file_scan': 'File scanning',
  'capability.usb_storage_gate': 'USB storage gate',
  'capability.usb_hid_gate': 'USB HID approval gate',
  'capability.wifi_guard': 'Wi-Fi guard',
  'capability.web_shield': 'Web & link checks',
  'capability.vault': 'Credential vault',
  'capability.proven': 'Proven',
  'capability.partial': 'Partial',
  'capability.unavailable': 'Unavailable',
  'capability.untested': 'Untested',
  'capability.not_implemented': 'This capability has not been implemented.',
  'capability.hardware_test_pending': 'Physical storage tests are pending.',
  'capability.hid_fixture_missing': 'An owned HID test device is required.',
  'capability.agent_not_connected': 'The local agent is not connected.',
  'capability.partial_scope': 'Works, but only for a limited scope.',
  'capability.reason_unknown': 'The reason is not available.',

  // Jobs
  'job.queued': 'Queued',
  'job.running': 'Running',
  'job.completed': 'Completed',
  'job.failed': 'Failed',
  'job.cancelled': 'Cancelled',

  // Notifications / awareness
  'notify.heading': 'Needs attention',
  'notify.empty': 'Nothing needs attention right now.',
  'notify.review': 'Review evidence',
  'notify.dismiss': 'Dismiss',
  'notify.dismissed': 'Dismissed ({count})',
  'notify.showDismissed': 'Show dismissed',
  'notify.risk.high': 'High-risk finding on {subject}',
  'notify.risk.suspicious': 'Suspicious signal on {subject}',
  'notify.risk.info': 'New information about {subject}',
  'notify.stale': 'The latest reading is {freshness}',
  'notify.capability.unavailable': 'Unavailable capability: {name}',

  // Awareness dialog (notification → evidence pattern)
  'awareness.title': 'Assessment',
  'awareness.close': 'Close',
  'awareness.whatObserved': 'What was observed',
  'awareness.subject': 'Subject',
  'awareness.observedAt': 'Observed',
  'awareness.expiresAt': 'Reading valid until',
  'awareness.why': 'Why it matters',
  'awareness.checks': 'Checks',
  'awareness.evidence': 'Evidence and limits',
  'awareness.engines': 'Engines',
  'awareness.noEngines': 'No analysis engine ran, so no engine version exists.',
  'awareness.noEvidenceRefs': 'No stored evidence references.',
  'awareness.choices': 'Choices',
  'awareness.action.review_capabilities': 'Review capability coverage',
  'awareness.action.open_inspector': 'Open file inspector',
  'awareness.action.unavailable': 'Not connected — this needs the local agent (tracked work)',
  'awareness.action.requiresAdmin': 'Requires administrator approval',
  'awareness.limitations':
    'This assessment covers only the checks listed here. Unknown, unavailable, or partial coverage means Sentinel is not claiming protection for anything else.',
  'awareness.fixtureNote': 'Fixture data: this scenario is built in for rehearsal and does not describe this device.',
  'awareness.learn': 'Learn more',
  'awareness.learn.unavailable': 'Academy lessons are not connected yet (tracked work).',

  // Placeholder views — honest, visibly pending
  'planned.heading': 'Planned, not connected yet',
  'planned.scan.body':
    'Quick, full, custom and removable scans with real scope, progress, cancel and inspected/skipped/error totals. Waiting on the authenticated agent and bounded scanner (issues #6/#7/#9; presentation in #11).',
  'planned.usb.body':
    'USB storage and HID interfaces shown separately, with actual hold/inspection/release state. No simulated detonation; storage release never approves HID (issues #12/#15).',
  'planned.wifi.body':
    'Plain-language Wi-Fi observations with timestamps and baseline comparison. Unknown checks never count as safe (issue #12).',
  'planned.web.body':
    'Link and download risk before transfer, separate from completed file inspection, with missing-native-host states (issues #8/#14; presentation in #11).',
  'planned.academy.body':
    'Short interactive lessons: Password Autopsy, Phishing Dojo, URL X-Ray and USB Autopsy first. Learning progress never counts as device protection (issue #14).',
  'planned.activity.body':
    'One bounded, redacted event history across scans, network, devices and browser findings. Secrets never appear here (issue #14).',
  'planned.dependency': 'Dependency',

  // Settings (real controls shipped here; the rest is planned)
  'settings.heading': 'Settings',
  'settings.display': 'Display preferences',
  'settings.motion': 'Reduce motion',
  'settings.motion.hint': 'Stops ambient sweeps and breathing effects.',
  'settings.transparency': 'Reduce transparency',
  'settings.transparency.hint': 'Uses opaque surfaces instead of glass.',
  'settings.planned': 'Provider consent, data retention, languages and redacted diagnostics are planned settings and are not connected yet.',

  // Scenario switcher (fixture-only rehearsal tool)
  'scenarios.heading': 'Fixture scenarios',
  'scenarios.hint': 'Switch the built-in dataset to rehearse states. This never reflects the real device.',
  'scenario.preview': 'Preview (mixed)',
  'scenario.clear': 'Complete checks, no findings',
  'scenario.suspicious': 'Suspicious finding',
  'scenario.high': 'High-risk finding',
  'scenario.stale': 'Stale reading',
  'scenario.offline': 'Agent unavailable',

  'details.heading': 'Technical details',
  'details.note': 'Fixture data only. No system policy has changed.',
  'common.unknown': 'Unknown',
} as const;

export type MessageKey = keyof typeof en;

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let message: string = en[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
  }
  return message;
}

export function hasMessageKey(key: string): key is MessageKey {
  return key in en;
}

/** Lookup for runtime-supplied keys (DTO reasonKey/messageKey) with a safe fallback. */
export function tDynamic(key: string, fallback: MessageKey): string {
  return key in en ? t(key as MessageKey) : t(fallback);
}
