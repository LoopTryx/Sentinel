import type { StatusSnapshot } from '@sentinel/contracts/generated/StatusSnapshot';
import sharedPreview from '../../../../data/fixtures/status.json';

/**
 * Labeled fixture scenarios used to rehearse dashboard states before the live
 * agent adapter exists ( Codex #6/#19 ). These are UI-owned demonstration
 * datasets — separate from the shared CLI/UI fixture in data/fixtures — and
 * are never presented as real device state: fixture mode forces the visible
 * "Fixture preview" banner in App.
 */

export const SCENARIO_IDS = ['preview', 'clear', 'suspicious', 'high', 'stale', 'offline'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

const NOW = '2026-10-03T10:00:00Z';
const EARLIER = '2026-10-03T09:50:00Z';
const LONG_AGO = '2026-10-03T08:00:00Z';

const clear: StatusSnapshot = {
  mode: 'fixture',
  assessment: {
    id: 'fixture-assessment-clear',
    subjectRef: 'demo-samples/notes.txt',
    risk: 'none_observed',
    confidence: 'medium',
    coverage: 'complete',
    checks: [
      { id: 'hash_lookup', state: 'pass', reasonKey: 'assessment.check.passed', evidenceRefs: [] },
      { id: 'eicar_scan', state: 'pass', reasonKey: 'assessment.check.passed', evidenceRefs: [] },
    ],
    reasons: [{ code: 'clean_checks', messageKey: 'assessment.reason.clean_checks' }],
    actions: [{ id: 'review_capabilities', requiresAdmin: false }],
    engineVersions: { 'hash-db': 'fixture-2026-10-01' },
    observedAt: EARLIER,
    expiresAt: null,
    lessonIds: [],
  },
  capabilities: [
    {
      id: 'file_scan',
      state: 'proven',
      reasonKey: 'capability.partial_scope',
      observedAt: EARLIER,
      evidenceRefs: ['fixture://evidence/hash-db-version'],
    },
    {
      id: 'usb_storage_gate',
      state: 'untested',
      reasonKey: 'capability.hardware_test_pending',
      observedAt: null,
      evidenceRefs: [],
    },
    {
      id: 'usb_hid_gate',
      state: 'untested',
      reasonKey: 'capability.hid_fixture_missing',
      observedAt: null,
      evidenceRefs: [],
    },
    {
      id: 'web_shield',
      state: 'unavailable',
      reasonKey: 'capability.agent_not_connected',
      observedAt: null,
      evidenceRefs: [],
    },
  ],
  job: null,
};

const suspicious: StatusSnapshot = {
  mode: 'fixture',
  assessment: {
    id: 'fixture-assessment-suspicious',
    subjectRef: 'demo-samples/invoice.pdf.exe',
    risk: 'suspicious',
    confidence: 'medium',
    coverage: 'partial',
    checks: [
      { id: 'hash_lookup', state: 'pass', reasonKey: 'assessment.check.passed', evidenceRefs: [] },
      {
        id: 'heuristics',
        state: 'finding',
        reasonKey: 'assessment.reason.heuristic_pattern',
        evidenceRefs: ['fixture://evidence/double-extension'],
      },
      { id: 'archive_walk', state: 'skipped', reasonKey: 'assessment.check.unavailable', evidenceRefs: [] },
    ],
    reasons: [
      { code: 'heuristic_pattern', messageKey: 'assessment.reason.heuristic_pattern' },
      { code: 'partial_coverage', messageKey: 'assessment.reason.partial_coverage' },
    ],
    actions: [
      { id: 'open_inspector', requiresAdmin: false },
      { id: 'review_capabilities', requiresAdmin: false },
    ],
    engineVersions: { heuristics: 'fixture-0.4' },
    observedAt: EARLIER,
    expiresAt: null,
    lessonIds: ['phishing-dojo'],
  },
  capabilities: [
    {
      id: 'file_scan',
      state: 'partial',
      reasonKey: 'capability.partial_scope',
      observedAt: EARLIER,
      evidenceRefs: ['fixture://evidence/scan-report-1'],
    },
    {
      id: 'usb_storage_gate',
      state: 'untested',
      reasonKey: 'capability.hardware_test_pending',
      observedAt: null,
      evidenceRefs: [],
    },
    {
      id: 'usb_hid_gate',
      state: 'untested',
      reasonKey: 'capability.hid_fixture_missing',
      observedAt: null,
      evidenceRefs: [],
    },
  ],
  job: { id: 'fixture-job-scan-7', ownerRef: 'fixture-user', state: 'completed' },
};

const high: StatusSnapshot = {
  mode: 'fixture',
  assessment: {
    id: 'fixture-assessment-high',
    subjectRef: 'demo-samples/eicar-simulation.txt',
    risk: 'high',
    confidence: 'high',
    coverage: 'complete',
    checks: [
      { id: 'hash_lookup', state: 'pass', reasonKey: 'assessment.check.passed', evidenceRefs: [] },
      {
        id: 'eicar_scan',
        state: 'finding',
        reasonKey: 'assessment.reason.signature_match',
        evidenceRefs: ['fixture://evidence/eicar-marker'],
      },
    ],
    reasons: [{ code: 'signature_match', messageKey: 'assessment.reason.signature_match' }],
    actions: [
      { id: 'open_inspector', requiresAdmin: false },
      { id: 'review_capabilities', requiresAdmin: false },
    ],
    engineVersions: { 'test-signatures': 'fixture-1.0' },
    observedAt: NOW,
    expiresAt: null,
    lessonIds: ['usb-autopsy'],
  },
  capabilities: [
    {
      id: 'file_scan',
      state: 'proven',
      reasonKey: 'capability.partial_scope',
      observedAt: NOW,
      evidenceRefs: ['fixture://evidence/scan-report-2'],
    },
    {
      id: 'usb_storage_gate',
      state: 'untested',
      reasonKey: 'capability.hardware_test_pending',
      observedAt: null,
      evidenceRefs: [],
    },
    {
      id: 'usb_hid_gate',
      state: 'untested',
      reasonKey: 'capability.hid_fixture_missing',
      observedAt: null,
      evidenceRefs: [],
    },
  ],
  job: { id: 'fixture-job-scan-8', ownerRef: 'fixture-user', state: 'completed' },
};

const stale: StatusSnapshot = {
  mode: 'fixture',
  assessment: {
    id: 'fixture-assessment-stale',
    subjectRef: 'demo-samples/old-report.txt',
    risk: 'none_observed',
    confidence: 'medium',
    coverage: 'complete',
    checks: [{ id: 'hash_lookup', state: 'pass', reasonKey: 'assessment.check.passed', evidenceRefs: [] }],
    reasons: [{ code: 'clean_checks', messageKey: 'assessment.reason.clean_checks' }],
    actions: [{ id: 'review_capabilities', requiresAdmin: false }],
    engineVersions: { 'hash-db': 'fixture-2026-09-01' },
    observedAt: LONG_AGO,
    expiresAt: '2026-10-03T09:00:00Z',
    lessonIds: [],
  },
  capabilities: [
    {
      id: 'file_scan',
      state: 'proven',
      reasonKey: 'capability.partial_scope',
      observedAt: LONG_AGO,
      evidenceRefs: [],
    },
    {
      id: 'usb_storage_gate',
      state: 'untested',
      reasonKey: 'capability.hardware_test_pending',
      observedAt: null,
      evidenceRefs: [],
    },
    {
      id: 'usb_hid_gate',
      state: 'untested',
      reasonKey: 'capability.hid_fixture_missing',
      observedAt: null,
      evidenceRefs: [],
    },
  ],
  job: null,
};

const offline: StatusSnapshot = {
  mode: 'fixture',
  assessment: {
    id: 'fixture-assessment-offline',
    subjectRef: 'device',
    risk: 'unknown',
    confidence: 'low',
    coverage: 'unavailable',
    checks: [
      { id: 'availability', state: 'error', reasonKey: 'assessment.check.unavailable', evidenceRefs: [] },
    ],
    reasons: [{ code: 'not_assessed', messageKey: 'assessment.reason.not_assessed' }],
    actions: [{ id: 'review_capabilities', requiresAdmin: false }],
    engineVersions: {},
    observedAt: NOW,
    expiresAt: null,
    lessonIds: [],
  },
  capabilities: [
    { id: 'file_scan', state: 'unavailable', reasonKey: 'capability.agent_not_connected', observedAt: null, evidenceRefs: [] },
    { id: 'usb_storage_gate', state: 'unavailable', reasonKey: 'capability.agent_not_connected', observedAt: null, evidenceRefs: [] },
    { id: 'usb_hid_gate', state: 'unavailable', reasonKey: 'capability.agent_not_connected', observedAt: null, evidenceRefs: [] },
    { id: 'wifi_guard', state: 'unavailable', reasonKey: 'capability.agent_not_connected', observedAt: null, evidenceRefs: [] },
  ],
  job: null,
};

export const scenarioFixtures: Record<ScenarioId, StatusSnapshot> = {
  preview: sharedPreview as StatusSnapshot,
  clear,
  suspicious,
  high,
  stale,
  offline,
};

export function isScenarioId(value: string | null): value is ScenarioId {
  return value !== null && (SCENARIO_IDS as readonly string[]).includes(value);
}
