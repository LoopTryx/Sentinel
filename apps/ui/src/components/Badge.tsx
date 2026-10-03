import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type BadgeKind = 'ok' | 'warn' | 'danger' | 'info' | 'unknown' | 'accent';

const kindIcons: Record<BadgeKind, IconName> = {
  ok: 'check-circle',
  warn: 'alert-triangle',
  danger: 'x-circle',
  info: 'info',
  unknown: 'shield-question',
  accent: 'info',
};

/** Status pill: icon + text, so meaning never rides on color alone. */
export function Badge({ kind, children }: { kind: BadgeKind; children: ReactNode }) {
  return (
    <span className="badge" data-kind={kind}>
      <Icon name={kindIcons[kind]} size={14} />
      {children}
    </span>
  );
}
