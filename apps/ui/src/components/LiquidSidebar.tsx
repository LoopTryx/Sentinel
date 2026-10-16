import {useId,type ReactNode} from 'react';
import './liquid-sidebar.css';
/** Layered glass adapted from the owner sample; content never receives a filter. */
export default function LiquidSidebar({collapsed,onToggle,children}:{collapsed:boolean;onToggle:()=>void;children:ReactNode}){
 const id=useId();
 return <aside className="sidebar liquid-sidebar" data-collapsed={collapsed} aria-label="Sentinel navigation">
  <div className="liquid-sidebar-optics" aria-hidden="true"><div className="liquid-sidebar-frost"/><div className="liquid-sidebar-tint"/><div className="liquid-sidebar-reflection"/><div className="liquid-sidebar-shine"/></div>
  <button type="button" className="sidebar-toggle" aria-expanded={!collapsed} aria-controls={id} aria-label={collapsed?'Expand navigation':'Collapse navigation'} title={collapsed?'Expand navigation':'Collapse navigation'} onClick={onToggle}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M9 4v16"/><path d={collapsed?'m13 9 3 3-3 3':'m16 9-3 3 3 3'}/></svg></button>
  <div className="liquid-sidebar-content" id={id}>{children}</div>
 </aside>;
}
