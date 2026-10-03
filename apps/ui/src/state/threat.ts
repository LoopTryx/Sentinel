import type { CapabilityState } from '@sentinel/contracts/generated/CapabilityState';
import type { Coverage } from '@sentinel/contracts/generated/Coverage';
import type { Risk } from '@sentinel/contracts/generated/Risk';
import type { StatusMode } from '@sentinel/contracts/generated/StatusMode';
import type { StatusSnapshot } from '@sentinel/contracts/generated/StatusSnapshot';

/**
 * Threat-state derivation (docs/ui/threat-state.md).
 *
 * Four axes are kept strictly separate: operating mode, latest-assessment
 * risk, assessment coverage, and reading freshness. Tone (the console's
 * ambient color) derives from risk AND coverage together — a clean result
 * with incomplete coverage is never green, and one good reading never says
 * the whole device is protected.
 */

export type Freshness = 'current' | 'stale' | 'expired' | 'unknown';
export type Tone = 'ok' | 'info' | 'warn' | 'danger' | 'unknown';

export type CapabilityRollup = Record<CapabilityState, number> & { total: number };

export interface ThreatView {
  mode: StatusMode;
  risk: Risk;
  coverage: Coverage;
  freshness: Freshness;
  tone: Tone;
  capabilities: CapabilityRollup;
}

/** Readings older than this are stale (matches the freshness axis copy). */
export const STALE_AFTER_MS = 15 * 60_000;

export function deriveFreshness(
  observedAt: string | null,
  expiresAt: string | null,
  now: Date,
): Freshness {
  if (!observedAt) return 'unknown';
  const observed = Date.parse(observedAt);
  if (Number.isNaN(observed)) return 'unknown';
  if (expiresAt) {
    const expiry = Date.parse(expiresAt);
    if (!Number.isNaN(expiry) && now.getTime() > expiry) return 'expired';
  }
  return now.getTime() - observed > STALE_AFTER_MS ? 'stale' : 'current';
}

export function deriveTone(risk: Risk, coverage: Coverage): Tone {
  if (risk === 'high') return 'danger';
  if (risk === 'suspicious') return 'warn';
  if (risk === 'info') return 'info';
  // none_observed only earns 'ok' when every planned check actually finished.
  if (risk === 'none_observed' && coverage === 'complete') return 'ok';
  return 'unknown';
}

export function rollupCapabilities(snapshot: StatusSnapshot): CapabilityRollup {
  const rollup: CapabilityRollup = { proven: 0, partial: 0, unavailable: 0, untested: 0, total: 0 };
  for (const capability of snapshot.capabilities) {
    rollup[capability.state] += 1;
    rollup.total += 1;
  }
  return rollup;
}

export function deriveThreatView(snapshot: StatusSnapshot, now: Date): ThreatView {
  const { assessment } = snapshot;
  return {
    mode: snapshot.mode,
    risk: assessment.risk,
    coverage: assessment.coverage,
    freshness: deriveFreshness(assessment.observedAt, assessment.expiresAt, now),
    tone: deriveTone(assessment.risk, assessment.coverage),
    capabilities: rollupCapabilities(snapshot),
  };
}
