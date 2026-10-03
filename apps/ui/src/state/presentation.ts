import type { CapabilityState } from '@sentinel/contracts/generated/CapabilityState';
import type { CheckState } from '@sentinel/contracts/generated/CheckState';
import type { Coverage } from '@sentinel/contracts/generated/Coverage';
import type { Risk } from '@sentinel/contracts/generated/Risk';
import type { BadgeKind } from '../components/Badge';
import type { IconName } from '../components/Icon';
import type { MessageKey } from '../i18n/en';
import type { Freshness, Tone } from './threat';

/** Shared mappings from contract values to presentation (kinds, icons, keys). */

export const riskBadge: Record<Risk, BadgeKind> = {
  none_observed: 'ok',
  info: 'info',
  suspicious: 'warn',
  high: 'danger',
  unknown: 'unknown',
};

export const riskLabelKey: Record<Risk, MessageKey> = {
  none_observed: 'assessment.noneObserved',
  info: 'assessment.info',
  suspicious: 'assessment.suspicious',
  high: 'assessment.high',
  unknown: 'assessment.unknown',
};

export const coverageBadge: Record<Coverage, BadgeKind> = {
  complete: 'ok',
  partial: 'warn',
  unavailable: 'unknown',
};

export const coverageLabelKey: Record<Coverage, MessageKey> = {
  complete: 'assessment.coverage.complete',
  partial: 'assessment.coverage.partial',
  unavailable: 'assessment.coverage.unavailable',
};

export const freshnessBadge: Record<Freshness, BadgeKind> = {
  current: 'ok',
  stale: 'warn',
  expired: 'danger',
  unknown: 'unknown',
};

export const freshnessLabelKey: Record<Freshness, MessageKey> = {
  current: 'assessment.freshness.current',
  stale: 'assessment.freshness.stale',
  expired: 'assessment.freshness.expired',
  unknown: 'assessment.freshness.unknown',
};

export const capabilityBadge: Record<CapabilityState, BadgeKind> = {
  proven: 'ok',
  partial: 'warn',
  unavailable: 'unknown',
  untested: 'unknown',
};

export const capabilityLabelKey: Record<CapabilityState, MessageKey> = {
  proven: 'capability.proven',
  partial: 'capability.partial',
  unavailable: 'capability.unavailable',
  untested: 'capability.untested',
};

export const checkBadge: Record<CheckState, BadgeKind> = {
  pass: 'ok',
  finding: 'danger',
  skipped: 'unknown',
  error: 'warn',
};

export const checkLabelKey: Record<CheckState, MessageKey> = {
  pass: 'assessment.check.passed',
  finding: 'assessment.check.finding',
  skipped: 'assessment.check.skipped',
  error: 'assessment.check.error',
};

export const toneIcon: Record<Tone, IconName> = {
  ok: 'check-circle',
  info: 'info',
  warn: 'shield-alert',
  danger: 'alert-triangle',
  unknown: 'shield-question',
};

export const capabilityIcon: Record<string, IconName> = {
  file_scan: 'scan',
  usb_storage_gate: 'usb',
  usb_hid_gate: 'usb',
  wifi_guard: 'wifi',
  web_shield: 'globe',
  vault: 'vault',
};
