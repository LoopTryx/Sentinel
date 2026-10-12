import {useState} from 'react';
import Icon from '../components/Icon';
import './glm-pages.css';
export default function QuarantineView() {
 const [filter,setFilter]=useState('All items');
 return <section className="panel glm-page">
  <div className="glm-page-heading"><div><span className="pm-eyebrow">SENTINEL / CONTAINMENT</span><h3 className="panel-title">Quarantine Vault</h3></div><span className="badge">Storage unavailable</span></div>
  <div className="glm-toolbar"><div className="glm-segments" role="group" aria-label="Vault filter">{['All items','Needs review'].map(label=><button key={label} type="button" aria-pressed={filter===label} onClick={()=>setFilter(label)}>{label}</button>)}</div><div className="glm-vault-actions"><button className="btn ghost" disabled>Restore</button><button className="btn ghost" disabled>Destroy</button></div></div>
  <div className="glm-vault-table"><div className="glm-vault-columns" aria-hidden="true"><span>File</span><span>Detection</span><span>Added</span></div><div className="glm-empty"><span className="glm-empty-icon"><Icon name="vault" size={40}/></span><h2>{filter==='All items'?'Vault not connected':'Review queue unavailable'}</h2><p>Quarantined files will appear here when storage is available.</p><span className="glm-caption">Restore & destruction are disabled</span></div></div>
  <details className="glm-details"><summary>Why are actions unavailable?</summary><p>Durable recovery must be reviewed before quarantine is enabled. This screen cannot read a live vault or establish that it is empty.</p></details>
 </section>;
}
