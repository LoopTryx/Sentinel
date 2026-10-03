import { useEffect, useState } from 'react';
import { Badge } from './components/Badge';
import { Icon, type IconName } from './components/Icon';
import { t, type MessageKey } from './i18n/en';
import {
  coverageBadge,
  coverageLabelKey,
  freshnessBadge,
  freshnessLabelKey,
  riskBadge,
  riskLabelKey,
} from './state/presentation';
import { useStatus } from './state/useStatus';
import { DashboardView } from './views/DashboardView';
import { PlannedView } from './views/PlannedView';
import { SettingsView } from './views/SettingsView';

type ViewId = 'dashboard' | 'scan' | 'usb' | 'wifi' | 'web' | 'academy' | 'activity' | 'settings';

interface NavItem {
  id: ViewId;
  labelKey: MessageKey;
  icon: IconName;
}

const navGroups: Array<{ labelKey: MessageKey; items: NavItem[] }> = [
  {
    labelKey: 'nav.group.monitor',
    items: [
      { id: 'dashboard', labelKey: 'nav.dashboard', icon: 'dashboard' },
      { id: 'scan', labelKey: 'nav.scan', icon: 'scan' },
    ],
  },
  {
    labelKey: 'nav.group.investigate',
    items: [
      { id: 'usb', labelKey: 'nav.usb', icon: 'usb' },
      { id: 'wifi', labelKey: 'nav.wifi', icon: 'wifi' },
      { id: 'web', labelKey: 'nav.web', icon: 'globe' },
    ],
  },
  {
    labelKey: 'nav.group.learn',
    items: [{ id: 'academy', labelKey: 'nav.academy', icon: 'graduation-cap' }],
  },
  {
    labelKey: 'nav.group.system',
    items: [
      { id: 'activity', labelKey: 'nav.activity', icon: 'activity' },
      { id: 'settings', labelKey: 'nav.settings', icon: 'settings' },
    ],
  },
];

const plannedBodies: Partial<Record<ViewId, MessageKey>> = {
  scan: 'planned.scan.body',
  usb: 'planned.usb.body',
  wifi: 'planned.wifi.body',
  web: 'planned.web.body',
  academy: 'planned.academy.body',
  activity: 'planned.activity.body',
};

const plannedTitles: Partial<Record<ViewId, MessageKey>> = {
  scan: 'nav.scan',
  usb: 'nav.usb',
  wifi: 'nav.wifi',
  web: 'nav.web',
  academy: 'nav.academy',
  activity: 'nav.activity',
};

const plannedIcons: Partial<Record<ViewId, IconName>> = {
  scan: 'scan',
  usb: 'usb',
  wifi: 'wifi',
  web: 'globe',
  academy: 'graduation-cap',
  activity: 'activity',
};

const connectionLabelKey = {
  fixture: 'rail.connection.fixture',
  connecting: 'rail.connection.connecting',
  live: 'rail.connection.live',
  unavailable: 'rail.connection.unavailable',
} as const;

/**
 * Y2K Cyber Console shell (issue #10): translucent sidebar + status rail over
 * a deep-navy base; the console's tone breathes the ACTUAL derived risk state
 * (ambient only — risk/coverage/freshness/mode are always also shown as text
 * badges). Fixture mode carries a permanent banner; ambient effects pause
 * when hidden and honor reduced-motion/reduced-transparency/forced-colors.
 */
export function App() {
  const search = typeof window === 'undefined' ? undefined : window.location.search;
  const status = useStatus(search);
  const [view, setView] = useState<ViewId>('dashboard');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [reducedTransparency, setReducedTransparency] = useState(false);

  useEffect(() => {
    const sync = () =>
      document.documentElement.toggleAttribute(
        'data-hidden',
        document.visibilityState === 'hidden',
      );
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return (
    <div
      className="app"
      data-tone={status.view.tone}
      data-mode={status.view.mode}
      data-motion={reducedMotion ? 'reduced' : 'full'}
      data-transparency={reducedTransparency ? 'reduced' : 'full'}
    >
      <a className="skip-link" href="#main-content">
        {t('app.skipToContent')}
      </a>
      <div className="shell">
        <header className="sidebar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Icon name="shield" size={24} />
            </span>
            <div>
              <p className="brand-name">{t('app.title')}</p>
              <p className="brand-tag">{t('app.tagline')}</p>
            </div>
          </div>

          <nav aria-label={t('app.title')}>
            {navGroups.map((group) => (
              <div className="nav-group" key={group.labelKey}>
                <p className="nav-group-title">{t(group.labelKey)}</p>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="nav-link"
                    aria-current={view === item.id ? 'page' : undefined}
                    onClick={() => setView(item.id)}
                  >
                    <Icon name={item.icon} size={17} />
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="status-rail" aria-label="console status">
            <dl>
              <div className="rail-row">
                <dt>{t('rail.mode')}</dt>
                <dd>
                  <Badge kind={status.view.mode === 'fixture' ? 'warn' : 'accent'}>
                    {t(`rail.mode.${status.view.mode}`)}
                  </Badge>
                </dd>
              </div>
              <div className="rail-row">
                <dt>{t('rail.connection')}</dt>
                <dd>{t(connectionLabelKey[status.connection])}</dd>
              </div>
              <div className="rail-row">
                <dt>{t('rail.risk')}</dt>
                <dd>
                  <Badge kind={riskBadge[status.view.risk]}>{t(riskLabelKey[status.view.risk])}</Badge>
                </dd>
              </div>
              <div className="rail-row">
                <dt>{t('rail.coverage')}</dt>
                <dd>
                  <Badge kind={coverageBadge[status.view.coverage]}>
                    {t(coverageLabelKey[status.view.coverage])}
                  </Badge>
                </dd>
              </div>
              <div className="rail-row">
                <dt>{t('rail.freshness')}</dt>
                <dd>
                  <Badge kind={freshnessBadge[status.view.freshness]}>
                    {t(freshnessLabelKey[status.view.freshness])}
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>
        </header>

        <main className="main" id="main-content" tabIndex={-1}>
          {status.view.mode === 'fixture' && (
            <div className="fixture-banner" role="status">
              <Icon name="alert-triangle" size={20} />
              <div>
                <strong>{t('fixture.banner')}</strong>
                <p>{t('fixture.detail')}</p>
              </div>
            </div>
          )}

          {view === 'dashboard' && <DashboardView status={status} />}
          {view === 'settings' && (
            <SettingsView
              reducedMotion={reducedMotion}
              reducedTransparency={reducedTransparency}
              onMotionChange={setReducedMotion}
              onTransparencyChange={setReducedTransparency}
            />
          )}
          {view !== 'dashboard' && view !== 'settings' && (
            <PlannedView
              titleKey={plannedTitles[view]!}
              bodyKey={plannedBodies[view]!}
              icon={plannedIcons[view] ?? 'shield'}
            />
          )}
        </main>
      </div>
    </div>
  );
}
