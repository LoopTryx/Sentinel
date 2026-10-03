import { Badge } from '../components/Badge';
import { t } from '../i18n/en';

/**
 * Settings: the two working display preferences ship with the shell (they
 * drive real [data-motion]/[data-transparency] attributes); provider consent,
 * retention, languages and diagnostics stay honestly marked as planned until
 * their owning issues land.
 */
export function SettingsView({
  reducedMotion,
  reducedTransparency,
  onMotionChange,
  onTransparencyChange,
}: {
  reducedMotion: boolean;
  reducedTransparency: boolean;
  onMotionChange: (value: boolean) => void;
  onTransparencyChange: (value: boolean) => void;
}) {
  return (
    <>
      <div className="view-heading">
        <h1>{t('settings.heading')}</h1>
      </div>
      <section className="panel" aria-labelledby="settings-display">
        <h2 id="settings-display">{t('settings.display')}</h2>
        <div className="switch-row">
          <div>
            <strong>{t('settings.motion')}</strong>
            <p>{t('settings.motion.hint')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reducedMotion}
            className="btn"
            onClick={() => onMotionChange(!reducedMotion)}
          >
            {reducedMotion ? 'On' : 'Off'}
          </button>
        </div>
        <div className="switch-row">
          <div>
            <strong>{t('settings.transparency')}</strong>
            <p>{t('settings.transparency.hint')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reducedTransparency}
            className="btn"
            onClick={() => onTransparencyChange(!reducedTransparency)}
          >
            {reducedTransparency ? 'On' : 'Off'}
          </button>
        </div>
      </section>
      <section className="panel" aria-labelledby="settings-planned">
        <h2 id="settings-planned">
          {t('planned.heading')} <Badge kind="unknown">{t('planned.dependency')}</Badge>
        </h2>
        <p>{t('settings.planned')}</p>
      </section>
    </>
  );
}
