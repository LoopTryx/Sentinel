import { useState } from 'react';
import type { Assessment } from '@sentinel/contracts/generated/Assessment';
import { AwarenessDialog } from '../components/AwarenessDialog';
import { Badge } from '../components/Badge';
import { CapabilityTile } from '../components/CapabilityTile';
import { Icon, type IconName } from '../components/Icon';
import { t, type MessageKey } from '../i18n/en';
import { SCENARIO_IDS, type ScenarioId } from '../state/fixtures';
import { deriveNotifications, type AppNotification } from '../state/notifications';
import {
  coverageBadge,
  coverageLabelKey,
  freshnessBadge,
  freshnessLabelKey,
  riskBadge,
  riskLabelKey,
  toneIcon,
} from '../state/presentation';
import type { StatusState } from '../state/useStatus';
import type { Tone } from '../state/threat';

const heroTitleKey: Record<Tone, MessageKey> = {
  ok: 'dashboard.hero.tone.ok',
  info: 'dashboard.hero.tone.info',
  warn: 'dashboard.hero.tone.warn',
  danger: 'dashboard.hero.tone.danger',
  unknown: 'dashboard.hero.tone.unknown',
};

const heroDetailKey: Record<Tone, MessageKey> = {
  ok: 'dashboard.hero.ok.detail',
  info: 'dashboard.hero.warn.detail',
  warn: 'dashboard.hero.warn.detail',
  danger: 'dashboard.hero.danger.detail',
  unknown: 'dashboard.hero.unknown.detail',
};

const severityIcon: Record<AppNotification['severity'], IconName> = {
  danger: 'alert-triangle',
  warn: 'shield-alert',
  info: 'info',
};

const scenarioLabelKey: Record<ScenarioId, MessageKey> = {
  preview: 'scenario.preview',
  clear: 'scenario.clear',
  suspicious: 'scenario.suspicious',
  high: 'scenario.high',
  stale: 'scenario.stale',
  offline: 'scenario.offline',
};

const jobLabelKey = {
  queued: 'job.queued',
  running: 'job.running',
  completed: 'job.completed',
  failed: 'job.failed',
  cancelled: 'job.cancelled',
} as const;

/**
 * Dashboard (master plan 15.2): separate risk / coverage / freshness / mode
 * axes, per-capability tiles, subject-bound awareness dialog from every
 * notification, real activity only when connected, and a permanently labeled
 * fixture scenario switcher. No aggregate protection percentage anywhere.
 */
export function DashboardView({ status }: { status: StatusState }) {
  const { snapshot, view, connection, scenario, setScenario, now } = status;
  const [openAssessment, setOpenAssessment] = useState<Assessment | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  const notifications = deriveNotifications(snapshot, now);
  const active = notifications.filter((n) => !dismissed.has(n.id));
  const hidden = notifications.filter((n) => dismissed.has(n.id));

  const dismiss = (id: string) => setDismissed((prev) => new Set(prev).add(id));

  return (
    <>
      <div className="view-heading">
        <h1>{t('dashboard.heading')}</h1>
        <Badge kind="accent">{t(`rail.mode.${view.mode}`)}</Badge>
      </div>

      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-row">
          <span className="hero-icon">
            <Icon name={toneIcon[view.tone]} size={30} />
          </span>
          <div>
            <h2 id="hero-heading">{t(heroTitleKey[view.tone])}</h2>
            <p>{t(heroDetailKey[view.tone])}</p>
          </div>
          <div style={{ marginInlineStart: 'auto' }}>
            <button type="button" className="btn btn-primary" onClick={() => setOpenAssessment(snapshot.assessment)}>
              {t('dashboard.reviewAssessment')}
            </button>
          </div>
        </div>
        <div className="hero-axes" role="group" aria-label="assessment axes">
          <Badge kind={riskBadge[view.risk]}>{t(riskLabelKey[view.risk])}</Badge>
          <Badge kind={coverageBadge[view.coverage]}>{t(coverageLabelKey[view.coverage])}</Badge>
          <Badge kind={freshnessBadge[view.freshness]}>{t(freshnessLabelKey[view.freshness])}</Badge>
        </div>
      </section>

      <section className="panel" aria-labelledby="attention-heading">
        <h2 id="attention-heading">{t('notify.heading')}</h2>
        {active.length === 0 && <p>{t('notify.empty')}</p>}
        {active.map((note) => (
          <div className="notification" data-severity={note.severity} key={note.id}>
            <span className="notification-icon">
              <Icon name={severityIcon[note.severity]} size={20} />
            </span>
            <div className="notification-body">
              <p>{t(note.titleKey, note.titleParams)}</p>
              <span className="mono">
                {note.subject}
                {note.observedAt ? ` · ${new Date(note.observedAt).toLocaleString()}` : ''}
              </span>
            </div>
            <div className="notification-actions">
              {/* Review only where the notification binds to the current assessment;
                  capability notices point at the tiles below instead. */}
              {note.subject === snapshot.assessment.subjectRef && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOpenAssessment(snapshot.assessment)}
                >
                  {t('notify.review')}
                </button>
              )}
              <button type="button" className="btn" onClick={() => dismiss(note.id)}>
                {t('notify.dismiss')}
              </button>
            </div>
          </div>
        ))}
        {hidden.length > 0 && (
          <p>
            <button type="button" className="btn" onClick={() => setShowDismissed(!showDismissed)}>
              {showDismissed ? t('notify.dismiss') : t('notify.showDismissed')} ·{' '}
              {t('notify.dismissed', { count: hidden.length })}
            </button>
          </p>
        )}
        {showDismissed &&
          hidden.map((note) => (
            <div className="notification" data-severity={note.severity} key={note.id}>
              <div className="notification-body">
                <p>{t(note.titleKey, note.titleParams)}</p>
              </div>
              <div className="notification-actions">
                {note.subject === snapshot.assessment.subjectRef && (
                  <button type="button" className="btn" onClick={() => setOpenAssessment(snapshot.assessment)}>
                    {t('notify.review')}
                  </button>
                )}
              </div>
            </div>
          ))}
      </section>

      <section className="panel" aria-labelledby="capabilities-heading">
        <h2 id="capabilities-heading">{t('dashboard.capabilities')}</h2>
        <p>
          {t('dashboard.capabilities.summary', {
            proven: view.capabilities.proven,
            total: view.capabilities.total,
          })}
        </p>
        <ul className="tiles">
          {snapshot.capabilities.map((capability) => (
            <CapabilityTile key={capability.id} capability={capability} />
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="activity-heading">
        <h2 id="activity-heading">{t('dashboard.activity')}</h2>
        {snapshot.job ? (
          <p>
            {t('dashboard.activity.job', { id: snapshot.job.id })}:{' '}
            <Badge kind={snapshot.job.state === 'failed' ? 'danger' : snapshot.job.state === 'completed' ? 'ok' : 'info'}>
              {t(jobLabelKey[snapshot.job.state])}
            </Badge>{' '}
            {snapshot.mode === 'fixture' && <span className="tile-time">{t('dashboard.activity.fixture')}</span>}
          </p>
        ) : (
          <p>{t('notify.empty')}</p>
        )}
        {connection === 'unavailable' && <p>{t('rail.connection.unavailable')}</p>}
      </section>

      <section className="panel" aria-labelledby="scenarios-heading">
        <h2 id="scenarios-heading">{t('scenarios.heading')}</h2>
        <div className="scenarios" role="group" aria-labelledby="scenarios-heading">
          <p className="scenarios-hint">{t('scenarios.hint')}</p>
          {SCENARIO_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="btn"
              aria-pressed={scenario === id}
              onClick={() => setScenario(id)}
            >
              {t(scenarioLabelKey[id])}
            </button>
          ))}
        </div>
      </section>

      <details className="panel">
        <summary>{t('details.heading')}</summary>
        <p>{t('details.note')}</p>
        <pre className="mono">{JSON.stringify(snapshot, null, 2)}</pre>
      </details>

      {openAssessment && (
        <AwarenessDialog
          assessment={openAssessment}
          fixture={snapshot.mode === 'fixture'}
          now={now}
          onClose={() => setOpenAssessment(null)}
        />
      )}
    </>
  );
}
