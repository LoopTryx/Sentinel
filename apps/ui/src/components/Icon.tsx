import type { CSSProperties } from 'react';

/**
 * Inline SVG icon set (Lucide-style, 24×24 stroke icons) so status is never
 * carried by color alone. No icon library is added; paths are self-contained.
 */
export type IconName =
  | 'shield'
  | 'shield-alert'
  | 'shield-question'
  | 'scan'
  | 'usb'
  | 'wifi'
  | 'globe'
  | 'vault'
  | 'graduation-cap'
  | 'activity'
  | 'settings'
  | 'alert-triangle'
  | 'check-circle'
  | 'x-circle'
  | 'info'
  | 'clock'
  | 'dashboard'
  | 'x';

const paths: Record<IconName, string> = {
  shield: 'M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3z',
  'shield-alert': 'M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3z M12 9v4 M12 16.5v.5',
  'shield-question': 'M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3z M10 9.5a2 2 0 1 1 3 1.7c-.6.35-1 .86-1 1.55v.25 M12 16.5v.5',
  scan: 'M4 8V6a2 2 0 0 1 2-2h2 M16 4h2a2 2 0 0 1 2 2v2 M20 16v2a2 2 0 0 1-2 2h-2 M8 20H6a2 2 0 0 1-2-2v-2 M3 12h18',
  usb: 'M12 21v-8 M12 13V7 M12 13c0-2 4-2 4-5 M12 13c0-2-4-2-4-5 M10 4h4v3h-4z M8 7.5h.01 M16 7.5h.01 M10 21a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  wifi: 'M2.5 8.5a15 15 0 0 1 19 0 M5.5 12a10 10 0 0 1 13 0 M8.5 15.5a5 5 0 0 1 7 0 M12 19h.01',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c2.7 2.6 4 5.6 4 9s-1.3 6.4-4 9c-2.7-2.6-4-5.6-4-9s1.3-6.4 4-9z',
  vault: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 12h.01 M7 19v2 M17 19v2',
  'graduation-cap': 'M2 9l10-5 10 5-10 5L2 9z M6 11.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5 M22 9v6',
  activity: 'M3 12h4l3 8 4-16 3 8h4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  'alert-triangle': 'M12 3L2 20h20L12 3z M12 9v5 M12 17.5v.5',
  'check-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8.5 12.5l2.5 2.5 4.5-5',
  'x-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9 9l6 6 M15 9l-6 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v6 M12 7.5V8',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3.5 2',
  dashboard: 'M4 4h7v7H4z M13 4h7v4h-7z M13 10h7v10h-7z M4 13h7v7H4z',
  x: 'M6 6l12 12 M18 6L6 18',
};

export function Icon({
  name,
  size = 18,
  label,
  style,
}: {
  name: IconName;
  size?: number;
  /** Accessible name; omit for decorative use next to visible text. */
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
