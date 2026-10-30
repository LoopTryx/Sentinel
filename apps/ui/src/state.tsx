import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type {ScanJobSnapshot} from '@sentinel/contracts/generated/ScanJobSnapshot';
import {validSnapshot} from '../../demo-runtime/inspection-wire.mjs';
import {demoCall} from './demo-bridge';
export type ThreatLevel = 'preview' | 'warn' | 'danger' | 'clear';
export interface TelemetryLine { kind: string; level: 'info' | 'warn' | 'danger'; message: string; detail: string | null; ts: string; seq: number }
interface ThreatCtx { snapshot: ScanJobSnapshot|null; inspectionError: string; resetScan: () => void; resetConsole: () => void; scanAlert: boolean; level: ThreatLevel; feed: TelemetryLine[]; setLevel: (level: ThreatLevel) => void; push: (line: Omit<TelemetryLine, 'seq'>) => void }
const Ctx = createContext<ThreatCtx | null>(null);
export function useThreat() { const value = useContext(Ctx); if (!value) throw new Error('Missing threat provider'); return value; }
/** Native scan findings take priority over local presentation scenarios. */
export function ThreatProvider({children}: {children: ReactNode}) {
  const [previewLevel, setLevel] = useState<ThreatLevel>('preview');
  const [scanAlert, setScanAlert] = useState(false);
  const [snapshot,setSnapshot]=useState<ScanJobSnapshot|null>(null);
  const [inspectionError,setInspectionError]=useState('');
  const generation=useRef(0);
  const currentJob=useRef<string|null>(null), ignoredJob=useRef<string|null>(null);
  const currentFingerprint=useRef(''),acknowledgedFingerprint=useRef('');
  const resetConsole=useCallback(()=>{acknowledgedFingerprint.current=currentFingerprint.current;setScanAlert(false);setLevel('preview');},[]);
  const resetScan=useCallback(()=>{generation.current++;ignoredJob.current=currentJob.current;setSnapshot(null);setScanAlert(false);setInspectionError('');},[]);
  useEffect(()=>{let live=true,busy=false;
    async function poll(){if(busy)return;busy=true;const epoch=generation.current;try{const result=await demoCall('inspection.read');
      if(result?.snapshot!==null&&!validSnapshot(result?.snapshot))throw new Error('Invalid inspection evidence.');
      if(live&&epoch===generation.current){const next=result.snapshot as ScanJobSnapshot|null;setInspectionError('');
        if(next&&next.jobRef!==ignoredJob.current){currentJob.current=next.jobRef;setSnapshot(next);currentFingerprint.current=JSON.stringify([next.jobRef,next.reports.map(report=>[report.reportRef,report.state,report.verdict,report.findings])]);if(currentFingerprint.current!==acknowledgedFingerprint.current&&next.reports.some(report=>report.verdict==='suspicious'||report.verdict==='signature_match'))setScanAlert(true);}
      }
    }catch(e){if(live&&epoch===generation.current)setInspectionError(e instanceof Error?e.message:'Inspection unavailable');}finally{busy=false;}}
    void poll();const timer=setInterval(poll,900);return()=>{live=false;clearInterval(timer);};
  },[]);
  const completedClear=!inspectionError&&snapshot?.state==='finished'&&!snapshot.cancellationRequested&&snapshot.reports.length>0&&snapshot.reports.every(r=>r.state==='completed'&&r.verdict==='none_observed'&&!!r.sha256&&r.logicalBytes===r.inspectedBytes);
  const level: ThreatLevel = scanAlert ? 'danger' : previewLevel==='danger'||previewLevel==='warn'?previewLevel:completedClear?'clear':previewLevel;
  const [feed, setFeed] = useState<TelemetryLine[]>([]);
  const seq = useRef(0);
  const push = useCallback((line: Omit<TelemetryLine, 'seq'>) => setFeed(previous => [{...line, seq: seq.current++}, ...previous].slice(0, 200)), []);
  useEffect(() => {document.body.dataset.threat = level; return () => {delete document.body.dataset.threat;};}, [level]);
  return <Ctx.Provider value={{level, feed, setLevel, push, scanAlert, snapshot, inspectionError, resetScan, resetConsole}}>{children}</Ctx.Provider>;
}

