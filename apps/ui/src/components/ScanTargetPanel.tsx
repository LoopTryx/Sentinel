import {useEffect,useState} from 'react';
import Icon from './Icon';
import './scan-target-panel.css';

type Props = {
 title?: string;
 description?: string;
 running: boolean;
 disabled: boolean;
 onChoose: (kind:'file'|'folder')=>void;
};

export default function ScanTargetPanel({title='Scan files & folders',description='Choose a target for local, read-only inspection.',running,disabled,onChoose}:Props){
 const [hidden,setHidden]=useState(()=>typeof document!=='undefined'&&document.hidden);
 useEffect(()=>{const change=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change);},[]);
 return <div className="scan-target-panel" aria-busy={running} data-paused={hidden||undefined}>
  <div className="scan-target-symbol" aria-hidden="true">
   {running?<><span className="scan-target-ring"/><span className="scan-target-core"><Icon name="scan" size={28}/></span></>:<Icon name="scan" size={42}/>}
  </div>
  <h2>{running?'Inspecting files…':title}</h2>
  <p>{running?'Reading selected bytes and checking local indicators.':description}</p>
  {running&&<div className="scan-target-progress" role="progressbar" aria-label="File inspection in progress" aria-valuetext="Working; percentage unavailable"><span/></div>}
  <div className="scan-target-actions">
   <button className="btn" disabled={disabled} onClick={()=>onChoose('file')}><Icon name="scan" size={18}/>Choose file</button>
   <button className="btn ghost" disabled={disabled} onClick={()=>onChoose('folder')}><Icon name="vault" size={18}/>Choose folder</button>
  </div>
  <span className="scan-target-caption">Files stay on your device · never executed</span>
 </div>;
}
