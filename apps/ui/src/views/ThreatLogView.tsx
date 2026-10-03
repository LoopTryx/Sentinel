import TelemetryFeed from '../components/TelemetryFeed';
import {useThreat} from '../state';
export default function ThreatLogView() {const {feed} = useThreat(); return <section className="panel"><h3 className="panel-title">Scenario activity</h3><p>Local session only · live threat history unavailable. No persistent monitoring is connected.</p><TelemetryFeed feed={feed}/></section>;}
