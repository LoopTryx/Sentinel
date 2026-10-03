import { Badge } from '../components/Badge';
import { Icon, type IconName } from '../components/Icon';
import { t, type MessageKey } from '../i18n/en';

/**
 * Honest placeholder for areas owned by later issues (#11-#14): the view
 * exists in navigation, explains what it will do and its tracked dependency,
 * and offers no silent no-op controls ("no operational control silently does
 * nothing" — GLM-UI state matrix).
 */
export function PlannedView({
  titleKey,
  bodyKey,
  icon,
}: {
  titleKey: MessageKey;
  bodyKey: MessageKey;
  icon: IconName;
}) {
  return (
    <>
      <div className="view-heading">
        <h1>{t(titleKey)}</h1>
        <Badge kind="unknown">{t('planned.heading')}</Badge>
      </div>
      <section className="panel" aria-labelledby="planned-heading">
        <h2 id="planned-heading">
          <Icon name={icon} /> {t('planned.dependency')}
        </h2>
        <p>{t(bodyKey)}</p>
      </section>
    </>
  );
}
