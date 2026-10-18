import {useEffect,useState,useRef} from 'react';
import {demoCall} from '../demo-bridge';
import './sentinel-ai.css';
export type {AiFinding} from '@sentinel/contracts/generated/AiFinding';
import type {AiFinding} from '@sentinel/contracts/generated/AiFinding';
import type {AiAnswer} from '@sentinel/contracts/generated/AiAnswer';
type Answer={provider:string;model:string;kind:string;answer:AiAnswer};
type Message={role:'user'|'assistant';text:string;answer?:Answer['answer']};
export default function SentinelAiView({context,onBusyChange}:{context?:{finding:AiFinding;question:string}|null;onBusyChange?:(busy:boolean)=>void}){
 const [status,setStatus]=useState<{provider:string;model:string;configured:boolean}|null>(null);
 const [finding,setFinding]=useState<AiFinding|null>(context?.finding??null),[question,setQuestion]=useState(context?.question??'');
 const [messages,setMessages]=useState<Message[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0);
 useEffect(()=>{void demoCall('ai.status').then(setStatus).catch(()=>setError('Desktop AI connection unavailable.'));},[]);
 useEffect(()=>{generation.current++;if(context){setFinding(context.finding);setQuestion(context.question);setMessages([]);}},[context]);
 async function settings(method:string){setError('');try{const r=await demoCall(method);if(method!=='ai.test')setStatus(r);else setError('NVIDIA returned a valid response to the approved test.');}catch(e){setError(e instanceof Error?e.message:'Settings unavailable.');}}
 async function send(){if(busy||!question.trim())return;setBusy(true);onBusyChange?.(true);setError('');const text=question;const requestGeneration=generation.current;try{const r:Answer=await demoCall('ai.send',{question:text,findingRef:finding?.ref??null});if(requestGeneration!==generation.current)return;setMessages(m=>[...m,{role:'user' as const,text},{role:'assistant' as const,text:r.answer.explanation,answer:r.answer}].slice(-40));setQuestion('');}catch(e){setError(e instanceof Error?e.message:'Request failed. Retry requires a new preview and approval.');}finally{setBusy(false);onBusyChange?.(false);}}
 return <section className="sentinel-ai"><div className="ai-heading"><div><span className="eyebrow">SENTINEL / ASSISTANT</span><h1>SentinelAI</h1><p>{status?`${status.provider} · ${status.model}`:'Connecting to desktop…'}</p></div><div className="ai-tools"><button disabled={busy} onClick={()=>void settings('ai.settings')}>Provider settings</button><button disabled={busy||!status?.configured} onClick={()=>void settings('ai.test')}>Test connection</button><button disabled={!status?.configured} onClick={()=>void settings('ai.remove')}>Remove key</button></div></div>
 {finding&&<aside className="ai-evidence"><h2>Observed local evidence</h2><p>{finding.url}</p><ul>{finding.signals.map(s=><li key={s.code}>{s.text}</li>)}</ul><p>{finding.limitation}</p><button disabled={busy} onClick={()=>{setFinding(null);setQuestion('');setMessages([]);}}>Start a general question</button></aside>}
 <div className="ai-thread" role="log" aria-label="Conversation" aria-live="polite">{messages.length===0&&<p>Ask about this finding or a security question. Each submission opens a native preview before anything is sent to NVIDIA.</p>}{messages.map((m,i)=><article key={i} className={`ai-message ai-${m.role}`}><strong>{m.role==='user'?'You':'SentinelAI · provider interpretation'}</strong><p>{m.text}</p>{m.answer&&<><p className="ai-uncertainty">{m.answer.uncertainty}</p><ul>{m.answer.recommendations.map((r,j)=><li key={j}>{r}</li>)}</ul></>}</article>)}</div>
 <form onSubmit={e=>{e.preventDefault();void send();}}><label htmlFor="ai-question">Your question</label><textarea id="ai-question" maxLength={2000} value={question} disabled={busy} onChange={e=>setQuestion(e.target.value)} rows={3}/><div className="ai-send"><span>Session history stays local. Earlier messages are not uploaded.</span>{busy?<button type="button" onClick={()=>void demoCall('ai.cancel').catch(()=>{})}>Cancel request</button>:<button disabled={!question.trim()||!status?.configured} type="submit">Preview & send</button>}</div></form>
 {busy&&<p role="status">Waiting for your approval or NVIDIA’s response…</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}

