import type { JobState } from '@sentinel/contracts/generated/JobState';
import type { Risk } from '@sentinel/contracts/generated/Risk';
import type { StatusSnapshot } from '@sentinel/contracts/generated/StatusSnapshot';
import fixture from '../../../data/fixtures/status.json';
import { t, type MessageKey } from './i18n/en';

const status = fixture as StatusSnapshot;

function capabilityName(id: string): string {
  const key = `capability.${id}` as MessageKey;
  return key in tMap ? t(key) : id;
}

const tMap: Record<string, true> = {
  'capability.file_scan': true,
  'capability.usb_storage_gate': true,
  'capability.usb_hid_gate': true,
};

function capabilityReason(reasonKey: string): string {
  const key = reasonKey as MessageKey;
  return key in reasonMap ? t(key) : t('capability.reason_unknown');
}

const reasonMap: Record<string, true> = {
  'capability.not_implemented': true,
  'capability.hardware_test_pending': true,
  'capability.hid_fixture_missing': true,
};

const riskLabels: Record<Risk, MessageKey> = {
  none_observed: 'assessment.noneObserved',
  info: 'assessment.info',
  suspicious: 'assessment.suspicious',
  high: 'assessment.high',
  unknown: 'assessment.unknown',
};

const jobLabels: Record<JobState, MessageKey> = {
  queued: 'job.queued',
  running: 'job.running',
  completed: 'job.completed',
  failed: 'job.failed',
  cancelled: 'job.cancelled',
};

export function App() {
  return (
    <main className="shell">
      <header className="masthead">
        <div className="mark" aria-hidden="true">S</div>
        <div>
          <p className="eyebrow">{t('app.fixture')}</p>
          <h1>{t('app.title')}</h1>
        </div>
      </header>

      <section className="notice" aria-labelledby="notice-heading">
        <h2 id="notice-heading">{t('app.noProtection')}</h2>
        <p>{t('app.intro')}</p>
      </section>

      <section aria-labelledby="assessment-heading" className="panel">
        <h2 id="assessment-heading">{t('assessment.heading')}</h2>
        <p className="status-value">{t(riskLabels[status.assessment.risk])}</p>
        <p>{t('assessment.unavailable')} · {t('assessment.reason.not_assessed')}</p>
      </section>

      <section aria-labelledby="capabilities-heading" className="panel">
        <h2 id="capabilities-heading">{t('capabilities.heading')}</h2>
        <ul className="capabilities">
          {status.capabilities.map((item) => (
            <li key={item.id} data-state={item.state}>
              <div>
                <h3>{capabilityName(item.id)}</h3>
                <p>{capabilityReason(item.reasonKey)}</p>
              </div>
              <strong>{t(`capability.${item.state}` as MessageKey)}</strong>
            </li>
          ))}
        </ul>
      </section>

      {status.job && (
        <section aria-labelledby="job-heading" className="panel">
          <h2 id="job-heading">{t('job.heading')}</h2>
          <p>{status.job.id}: {t(jobLabels[status.job.state])}</p>
        </section>
      )}

      <details className="panel">
        <summary>{t('details.heading')}</summary>
        <p>{t('details.note')}</p>
        <pre>{JSON.stringify(status, null, 2)}</pre>
      </details>
    </main>
  );
}
