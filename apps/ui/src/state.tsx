import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
export type ThreatLevel = 'preview' | 'warn' | 'danger';
export interface TelemetryLine { kind: string; level: 'info' | 'warn' | 'danger'; message: string; detail: string | null; ts: string; seq: number }
interface ThreatCtx { level: ThreatLevel; feed: TelemetryLine[]; setLevel: (level: ThreatLevel) => void; push: (line: Omit<TelemetryLine, 'seq'>) => void }
const Ctx = createContext<ThreatCtx | null>(null);
export function useThreat() { const value = useContext(Ctx); if (!value) throw new Error('Missing threat provider'); return value; }
/** Local presentation scenarios only. No native telemetry or live capability is connected. */
export function ThreatProvider({children}: {children: ReactNode}) {
  const [level, setLevel] = useState<ThreatLevel>('preview');
  const [feed, setFeed] = useState<TelemetryLine[]>([]);
  const seq = useRef(0);
  const push = useCallback((line: Omit<TelemetryLine, 'seq'>) => setFeed(previous => [{...line, seq: seq.current++}, ...previous].slice(0, 200)), []);
  useEffect(() => {document.body.dataset.threat = level; return () => {delete document.body.dataset.threat;};}, [level]);
  return <Ctx.Provider value={{level, feed, setLevel, push}}>{children}</Ctx.Provider>;
}

