import { useEffect, useRef } from 'react';
import type { Assessment } from '@sentinel/contracts/generated/Assessment';
import { hasMessageKey, t, tDynamic, type MessageKey } from '../i18n/en';
import {
  checkBadge,
  checkLabelKey,
  coverageBadge,
  coverageLabelKey,
  freshnessBadge,
  freshnessLabelKey,
  riskBadge,
  riskLabelKey,
} from '../state/presentation';
import { deriveFreshness } from '../state/threat';
import { Badge } from './Badge';
import { Icon } from './Icon';

/**
 * Reusable awareness dialog: one pattern for file, network, link, download
 * and password warnings (master plan 15.2 + journey C). Always bound to a
 * concrete subject and observation time; separates risk/coverage/freshness;
 * states limitations and a safe next step; actions that need the live agent
 * are visibly disabled instead of silently doing nothing.
 *
 * Accessibility: role=dialog + aria-modal, labelled by its heading, focus
 * moves in on open, Tab/Shift+Tab cycle within, Escape closes, focus returns
 * to the invoking control. Critical content is static text — no flashing.
 */
export function AwarenessDialog({
  assessment,
  fixture,
  now,
  onClose,
}: {
  assessment: Assessment;
  /** Show the fixture disclaimer (driven by snapshot.mode, never hidden in fixture mode). */
  fixture: boolean;
  now: Date;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog) {
      const first = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog;
      first.focus();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      const restore = restoreFocusRef.current;
      if (restore instanceof HTMLElement) restore.focus();
    };
  }, [onClose]);

  const freshness = deriveFreshness(assessment.observedAt, assessment.expiresAt, now);
  const actionLabels: Record<string, string> = {
    review_capabilities: t('awareness.action.review_capabilities'),
    open_inspector: t('awareness.action.open_inspector'),
  };

  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="awareness-heading"
        tabIndex={-1}
      >
        <div className="dialog-head">
          <h2 id="awareness-heading">
            <Icon name={assessment.risk === 'unknown' ? 'shield-question' : 'shield-alert'} size={22} />
            {t('awareness.title')}
          </h2>
          <button type="button" className="btn" onClick={onClose} data-autofocus>
            <Icon name="x" size={14} />
            {t('awareness.close')}
          </button>
        </div>

        <div className="dialog-body">
          {fixture && <p className="dialog-limitations">{t('awareness.fixtureNote')}</p>}

          <section aria-labelledby="awareness-observed">
            <h3 id="awareness-observed">{t('awareness.whatObserved')}</h3>
            <div className="panel-opaque">
              <dl>
                <dt>{t('awareness.subject')}</dt>
                <dd className="mono">{assessment.subjectRef}</dd>
                <dt>{t('awareness.observedAt')}</dt>
                <dd>
                  {new Date(assessment.observedAt).toLocaleString()}{' '}
                  <Badge kind={freshnessBadge[freshness]}>{t(freshnessLabelKey[freshness])}</Badge>
                </dd>
                {assessment.expiresAt && (
                  <>
                    <dt>{t('awareness.expiresAt')}</dt>
                    <dd>{new Date(assessment.expiresAt).toLocaleString()}</dd>
                  </>
                )}
                <dt>{t('rail.risk')}</dt>
                <dd>
                  <Badge kind={riskBadge[assessment.risk]}>{t(riskLabelKey[assessment.risk])}</Badge>
                </dd>
                <dt>{t('rail.coverage')}</dt>
                <dd>
                  <Badge kind={coverageBadge[assessment.coverage]}>
                    {t(coverageLabelKey[assessment.coverage])}
                  </Badge>
                </dd>
              </dl>
            </div>
          </section>

          <section aria-labelledby="awareness-why">
            <h3 id="awareness-why">{t('awareness.why')}</h3>
            <ul className="check-list">
              {assessment.reasons.map((reason) => (
                <li key={reason.code}>
                  <Icon name="info" size={14} />
                  <span>{tDynamic(reason.messageKey, 'capability.reason_unknown')}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="awareness-checks">
            <h3 id="awareness-checks">{t('awareness.checks')}</h3>
            <ul className="check-list">
              {assessment.checks.map((check) => (
                <li key={check.id}>
                  <Badge kind={checkBadge[check.state]}>{t(checkLabelKey[check.state])}</Badge>
                  <span className="check-name">
                    {hasMessageKey(`check.${check.id}`) ? t(`check.${check.id}` as MessageKey) : check.id}
                  </span>
                  <span className="check-reason">{tDynamic(check.reasonKey, 'capability.reason_unknown')}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="awareness-evidence">
            <h3 id="awareness-evidence">{t('awareness.evidence')}</h3>
            <div className="panel-opaque">
              <dl>
                <dt>{t('awareness.engines')}</dt>
                <dd>
                  {Object.keys(assessment.engineVersions).length > 0 ? (
                    Object.entries(assessment.engineVersions).map(([engine, version]) => (
                      <span key={engine} className="mono">
                        {engine} {version}{' '}
                      </span>
                    ))
                  ) : (
                    <span>{t('awareness.noEngines')}</span>
                  )}
                </dd>
                <dt>{t('awareness.evidence')}</dt>
                <dd>
                  {assessment.checks.flatMap((c) => c.evidenceRefs).length > 0 ? (
                    assessment.checks
                      .flatMap((c) => c.evidenceRefs)
                      .map((ref) => (
                        <span key={ref} className="mono">
                          {ref}
                          <br />
                        </span>
                      ))
                  ) : (
                    <span>{t('awareness.noEvidenceRefs')}</span>
                  )}
                </dd>
              </dl>
            </div>
            <p className="dialog-limitations">{t('awareness.limitations')}</p>
          </section>

          <section aria-labelledby="awareness-choices">
            <h3 id="awareness-choices">{t('awareness.choices')}</h3>
            {assessment.actions.map((action) => (
              <div key={action.id}>
                {/* Actions require the live agent (LOGIC-01); visibly disabled, never silent. */}
                <button type="button" className="btn" disabled aria-disabled="true" title={t('awareness.action.unavailable')}>
                  {actionLabels[action.id] ?? action.id}
                </button>
                <span className="btn-note">
                  {t('awareness.action.unavailable')}
                  {action.requiresAdmin ? ` · ${t('awareness.action.requiresAdmin')}` : ''}
                </span>
              </div>
            ))}
            <h3>{t('awareness.learn')}</h3>
            {assessment.lessonIds.length > 0 ? (
              assessment.lessonIds.map((lesson) => (
                <div key={lesson}>
                  <button type="button" className="btn" disabled aria-disabled="true" title={t('awareness.learn.unavailable')}>
                    <Icon name="graduation-cap" size={14} />
                    {lesson}
                  </button>
                  <span className="btn-note">{t('awareness.learn.unavailable')}</span>
                </div>
              ))
            ) : (
              <p>{t('awareness.learn.unavailable')}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
