import {useCallback,useEffect,useId,useRef,useState,type CSSProperties,type ReactNode,type SyntheticEvent} from 'react';
import {createPortal} from 'react-dom';
import './liquid-sidebar.css';
/** Presentation only. Navigation and collapse state remain owned by Shell. */
export default function LiquidSidebar({collapsed,onToggle,children}:{collapsed:boolean;onToggle:()=>void;children:ReactNode}){
 const id=useId(),filterId=`sidebar-glass-${id.replace(/[^a-zA-Z0-9_-]/g,'')}`,tipId=`${filterId}-tooltip`;
 const aside=useRef<HTMLElement>(null),described=useRef<HTMLButtonElement|null>(null),priorDescription=useRef<string|null>(null);
 const [tip,setTip]=useState<{label:string;left:number;top:number}|null>(null);
 const restoreDescription=useCallback(()=>{const button=described.current;if(button?.getAttribute('aria-describedby')===tipId){if(priorDescription.current===null)button.removeAttribute('aria-describedby');else button.setAttribute('aria-describedby',priorDescription.current);}described.current=null;},[tipId]);
 const hideTip=useCallback(()=>{restoreDescription();setTip(null);},[restoreDescription]);
 useEffect(()=>{hideTip();},[collapsed,hideTip]);
 useEffect(()=>()=>restoreDescription(),[restoreDescription]);
 useEffect(()=>{
  const root=aside.current;if(!root)return;let visible=true;
  const update=()=>{root.dataset.motionPaused=String(document.hidden||!visible);};
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);update();});
  observer?.observe(root);document.addEventListener('visibilitychange',update);update();
  return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',update);};
 },[]);
 useEffect(()=>{
  if(!tip)return;const visibility=()=>{if(document.hidden)hideTip();};
  const update=()=>{const button=described.current;if(!button)return;const rect=button.getBoundingClientRect(),width=Math.min(220,tip.label.length*8+24),left=Math.max(8,Math.min(rect.right+12,window.innerWidth-width-8)),top=Math.max(24,Math.min(rect.top+rect.height/2,window.innerHeight-24));setTip(previous=>previous&&previous.left===left&&previous.top===top?previous:previous?{...previous,left,top}:null);};
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);if(described.current)observer?.observe(described.current);
  window.addEventListener('resize',hideTip);document.addEventListener('scroll',hideTip,true);document.addEventListener('visibilitychange',visibility);
  return()=>{observer?.disconnect();window.removeEventListener('resize',hideTip);document.removeEventListener('scroll',hideTip,true);document.removeEventListener('visibilitychange',visibility);};
 },[tip?.label,hideTip]);
 const showTip=(event:SyntheticEvent)=>{
  if(!collapsed||!(event.target instanceof Element))return;
  const button=event.target.closest<HTMLButtonElement>('button.nav-btn[aria-label],button.sidebar-toggle[aria-label]');if(!button||described.current===button)return;
  const label=button.getAttribute('aria-label')?.slice(0,80);if(!label)return;
  restoreDescription();const rect=button.getBoundingClientRect();const width=Math.min(220,label.length*8+24);
  described.current=button;priorDescription.current=button.getAttribute('aria-describedby');button.setAttribute('aria-describedby',tipId);
  setTip({label,left:Math.max(8,Math.min(rect.right+12,window.innerWidth-width-8)),top:Math.max(24,Math.min(rect.top+rect.height/2,window.innerHeight-24))});
 };
 return <aside ref={aside} className="sidebar liquid-sidebar" data-collapsed={collapsed} data-hover-expand="true" aria-label="Sentinel navigation" style={{'--sidebar-refraction-filter':`url(#${filterId})`} as CSSProperties} onPointerOver={showTip} onPointerOut={event=>{const button=described.current;if(button&&event.relatedTarget instanceof Node&&button.contains(event.relatedTarget))return;hideTip();}} onFocusCapture={showTip} onBlurCapture={hideTip} onClickCapture={hideTip}>
  <div className="liquid-sidebar-optics" aria-hidden="true">
   <svg className="liquid-sidebar-refraction-defs" width="0" height="0"><defs><filter id={filterId} x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="1" seed="17" result="refraction"/><feDisplacementMap in="SourceGraphic" in2="refraction" scale="2" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>
   <div className="liquid-sidebar-frost"/><div className="liquid-sidebar-tint"/><div className="liquid-sidebar-bloom"/><div className="liquid-sidebar-bloom second"/><div className="liquid-sidebar-reflection"/><div className="liquid-sidebar-shine"/>
  </div>
  <button type="button" className="sidebar-toggle" aria-expanded={!collapsed} aria-controls={id} aria-label={collapsed?'Expand navigation':'Collapse navigation'} onClick={onToggle}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M9 4v16"/><path d={collapsed?'m13 9 3 3-3 3':'m16 9-3 3 3 3'}/></svg></button>
  <div className="liquid-sidebar-content" id={id}>{children}</div>
  {tip&&typeof document!=='undefined'&&createPortal(<div id={tipId} role="tooltip" className="sidebar-glass-tooltip" style={{left:tip.left,top:tip.top}}>{tip.label}</div>,document.body)}
 </aside>;
}
