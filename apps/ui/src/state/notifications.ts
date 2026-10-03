import type { StatusSnapshot } from '@sentinel/contracts/generated/StatusSnapshot';
import type { MessageKey } from '../i18n/en';
import { deriveFreshness, type Freshness } from './threat';

/**
 * Notification derivation for the dashboard attention panel.
 * Rules (docs/ui/threat-state.md):
 * - one notification per subject-bound assessment, deduplicated by assessment id
 * - a stale/expired reading surfaces once as its own notification
 * - unavailable capabilities surface once per capability id
 * - notifications carry the assessment/subject + observation time so the
 *   awareness dialog can always open evidence bound to that reading
 */
export type NotificationSeverity = 'danger' | 'warn' | 'info';

export interface AppNotification {
  id: string;
  severity: NotificationSeverity;
  titleKey: MessageKey;
  titleParams?: Record<string, string | number>;
  /** Subject the notification binds to (assessment subjectRef or capability id). */
  subject: string;
  observedAt: string | null;
}

const severityRank: Record<NotificationSeverity, number> = { danger: 0, warn: 1, info: 2 };

export function deriveNotifications(snapshot: StatusSnapshot, now: Date): AppNotification[] {
  const notes: AppNotification[] = [];
  const { assessment } = snapshot;

  if (assessment.risk === 'high' || assessment.risk === 'suspicious' || assessment.risk === 'info') {
    notes.push({
      id: `risk:${assessment.id}`,
      severity: assessment.risk === 'high' ? 'danger' : assessment.risk === 'suspicious' ? 'warn' : 'info',
      titleKey:
        assessment.risk === 'high'
          ? 'notify.risk.high'
          : assessment.risk === 'suspicious'
            ? 'notify.risk.suspicious'
            : 'notify.risk.info',
      titleParams: { subject: assessment.subjectRef },
      subject: assessment.subjectRef,
      observedAt: assessment.observedAt,
    });
  }

  const freshness: Freshness = deriveFreshness(assessment.observedAt, assessment.expiresAt, now);
  if (freshness === 'stale' || freshness === 'expired') {
    notes.push({
      id: `freshness:${assessment.id}`,
      severity: 'warn',
      titleKey: 'notify.stale',
      titleParams: { freshness },
      subject: assessment.subjectRef,
      observedAt: assessment.observedAt,
    });
  }

  for (const capability of snapshot.capabilities) {
    if (capability.state === 'unavailable') {
      notes.push({
        id: `capability:${capability.id}`,
        severity: 'info',
        titleKey: 'notify.capability.unavailable',
        titleParams: { name: capability.id },
        subject: capability.id,
        observedAt: capability.observedAt,
      });
    }
  }

  return notes.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id),
  );
}
