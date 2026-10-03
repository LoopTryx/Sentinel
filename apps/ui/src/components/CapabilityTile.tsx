import type { CapabilityStatus } from '@sentinel/contracts/generated/CapabilityStatus';
import { t, tDynamic, type MessageKey } from '../i18n/en';
import { capabilityBadge, capabilityIcon, capabilityLabelKey } from '../state/presentation';
import { Badge } from './Badge';
import { Icon } from './Icon';

const capabilityNameKeys: Record<string, MessageKey> = {
  file_scan: 'capability.file_scan',
  usb_storage_gate: 'capability.usb_storage_gate',
  usb_hid_gate: 'capability.usb_hid_gate',
  wifi_guard: 'capability.wifi_guard',
  web_shield: 'capability.web_shield',
  vault: 'capability.vault',
};

export function capabilityName(id: string): string {
  const key = capabilityNameKeys[id];
  return key ? t(key) : id;
}

/** One capability with its own proven/partial/unavailable/untested state. */
export function CapabilityTile({ capability }: { capability: CapabilityStatus }) {
  return (
    <li className="tile" data-state={capability.state}>
      <div className="tile-head">
        <h3>
          <Icon name={capabilityIcon[capability.id] ?? 'shield'} />
          {capabilityName(capability.id)}
        </h3>
        <Badge kind={capabilityBadge[capability.state]}>{t(capabilityLabelKey[capability.state])}</Badge>
      </div>
      <p>{tDynamic(capability.reasonKey, 'capability.reason_unknown')}</p>
      <span className="tile-time">
        {capability.observedAt
          ? t('dashboard.capabilities.observedAt', { time: new Date(capability.observedAt).toLocaleString() })
          : t('dashboard.capabilities.neverChecked')}
      </span>
    </li>
  );
}
