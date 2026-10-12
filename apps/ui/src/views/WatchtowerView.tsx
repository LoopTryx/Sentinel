import {useState} from 'react';
import Icon from '../components/Icon';
import {demoCall} from '../demo-bridge';
import {useAutoRefresh} from '../use-auto-refresh';
import './glm-pages.css';
type Report={version:1;observedAt:string;coverage:'passive';observation:Record<string,string>;checks:{level:string;title:string;detail:string}[];limitations:string[]};
const rows=[['connection','Connection'],['profile','Windows profile'],['security','Wi-Fi encryption'],['gateway','Default gateway'],['dns','DNS configuration'],['vpn','VPN adapter'],['proxy','User proxy configuration']];
const labels:Record<string,string>={wifi:'Wi-Fi',ethernet:'Ethernet',disconnected:'Disconnected',unknown:'Unavailable',public:'Public',private:'Private',domain:'Domain managed',open:'Open',wep:'WEP',wpa2:'WPA2',wpa3:'WPA3',configured:'Configured',missing:'Not observed',observed:'Adapter observed',not_configured:'Not configured'};
export default function WatchtowerView(){
 const [report,setReport]=useState<Report|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function check(){setBusy(true);setError('');try{const value=await demoCall('wifi.assess');if(value?.version!==1||value.coverage!=='passive'||!value.observation||!Array.isArray(value.checks)||!Array.isArray(value.limitations))throw Error();setReport(value);}catch{setReport(null);setError('Network observations are unavailable. Check that the console is connected and Windows permits access.');}finally{setBusy(false);}}
 useAutoRefresh(check,30000);
 return <><section className="panel"><div className="section-head"><div><span className="eyebrow">WATCHTOWER / NETWORK</span><h2>Wi-Fi checks</h2></div><Icon name="wifi" size={28}/></div><p>Understand your current connection, its security settings and what needs attention.</p><button className="btn" onClick={()=>void check()} disabled={busy}><Icon name="radar" size={15}/>{busy?'Checking network…':'Check network'}</button>{error&&<p role="alert">{error}</p>}{!report&&!busy&&!error&&<p className="small">Run a check to read this device’s current network configuration.</p>}</section>
 {report&&<><section className="panel"><div className="section-head"><h3 className="panel-title">Connection overview</h3><span className="small">Checked {new Date(report.observedAt).toLocaleTimeString()}</span></div><dl className="usb-summary-grid">{rows.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{labels[report.observation[key]]??'Unavailable'}</dd></div>)}</dl></section>
 <section className="panel"><h3 className="panel-title">What this means</h3>{report.checks.length?report.checks.map((item,index)=><details key={index} className="setting-card" style={{padding:'14px 0',borderBottom:'1px solid var(--grid-line)'}}><summary style={{cursor:'pointer',color:item.level==='warn'?'var(--warn)':'var(--text)'}}>{item.title}</summary><p>{item.detail}</p></details>):<p>No warning was identified in the available configuration checks.</p>}<details style={{marginTop:20}}><summary>Check coverage</summary><p>Passive local observations. No traffic capture or network changes.</p><ul>{report.limitations.map(item=><li key={item}>{item}</li>)}</ul><p>Unavailable fields can result from missing permission, multiple active adapters or unsupported/localized Windows output.</p></details></section></>}
 </>;
}
