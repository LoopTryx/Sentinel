export const en = {
  'app.title': 'Sentinel',
  'app.fixture': 'Fixture preview',
  'app.noProtection': 'No live protection is installed',
  'app.intro': 'This screen shows a shared test report while the security components are being built.',
  'assessment.heading': 'Current assessment',
  'assessment.unknown': 'Unknown',
  'assessment.noneObserved': 'No threats found in completed checks',
  'assessment.info': 'Information',
  'assessment.suspicious': 'Suspicious',
  'assessment.high': 'High risk',
  'assessment.unavailable': 'Checks unavailable',
  'assessment.reason.not_assessed': 'This subject has not been assessed.',
  'assessment.check.unavailable': 'The check could not run.',
  'capabilities.heading': 'Capability coverage',
  'capability.file_scan': 'File scanning',
  'capability.usb_storage_gate': 'USB storage gate',
  'capability.usb_hid_gate': 'USB HID approval gate',
  'capability.proven': 'Proven',
  'capability.partial': 'Partial',
  'capability.unavailable': 'Unavailable',
  'capability.untested': 'Untested',
  'capability.not_implemented': 'This capability has not been implemented.',
  'capability.hardware_test_pending': 'Physical storage tests are pending.',
  'capability.hid_fixture_missing': 'An owned HID test device is required.',
  'capability.reason_unknown': 'The reason is not available.',
  'job.heading': 'Fixture job',
  'job.queued': 'Queued',
  'job.running': 'Running',
  'job.completed': 'Completed',
  'job.failed': 'Failed',
  'job.cancelled': 'Cancelled',
  'details.heading': 'Technical details',
  'details.note': 'Fixture data only. No system policy has changed.',
} as const;

export type MessageKey = keyof typeof en;

export function t(key: MessageKey): string {
  return en[key];
}
