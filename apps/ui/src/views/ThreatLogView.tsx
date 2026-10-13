import TelemetryFeed from '../components/TelemetryFeed';
import {useThreat} from '../state';
import {useDemoState} from '../demo-bridge';
import DemoConnection from './DemoConnection';
import {useState} from 'react';
import './glm-pages.css';
export default function ThreatLogView(){const {feed}=useThreat();const {state}=useDemoState();const [showScenarios,setShowScenarios]=useState(false);return <><DemoConnection/><section className="panel"><h3 className="panel-title">Desktop & browser activity</h3><p>Actual local demo session events · reason codes only · no URL, message or password content retained.</p>{state?.events.map(e=><div className="pm-advice" key={e.id}><strong>{e.source} · {e.kind.replaceAll('_',' ')}</strong><p>{e.codes.join(' · ')||'Local action completed'} · {new Date(e.at).toLocaleTimeString()}</p></div>)}{!state?.events.length&&<p>No connected events yet.</p>}<button type="button" className="btn ghost scenario-toggle" aria-expanded={showScenarios} aria-controls="presentation-scenarios" onClick={()=>setShowScenarios(value=>!value)}>{showScenarios?'Hide presentation scenarios':'Show presentation scenarios'}</button><section id="presentation-scenarios" hidden={!showScenarios}><h4>Labeled presentation scenarios</h4><TelemetryFeed feed={feed}/></section></section></>;}
