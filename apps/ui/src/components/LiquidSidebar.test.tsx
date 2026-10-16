// @vitest-environment jsdom
import {act,useState} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';
import LiquidSidebar from './LiquidSidebar';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('collapses and expands without unmounting navigation; native keyboard button and page action stay available',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),navigate=vi.fn();
 function Demo(){const [collapsed,setCollapsed]=useState(false);return <LiquidSidebar collapsed={collapsed} onToggle={()=>setCollapsed(value=>!value)}><nav><button aria-label="Scan & Detect" title="Scan & Detect" onClick={navigate}>Scan & Detect</button></nav></LiquidSidebar>;}
 try{await act(()=>root.render(<Demo/>));const toggle=host.querySelector('.sidebar-toggle') as HTMLButtonElement;const page=host.querySelector('nav button') as HTMLButtonElement;
 expect(toggle.getAttribute('aria-expanded')).toBe('true');expect(host.querySelectorAll('.liquid-sidebar-optics[aria-hidden=true]')).toHaveLength(1);expect(document.getElementById(toggle.getAttribute('aria-controls')!)).not.toBeNull();
 toggle.focus();expect(document.activeElement).toBe(toggle);await act(()=>toggle.click());expect(toggle.getAttribute('aria-expanded')).toBe('false');expect(host.querySelector('aside')?.dataset.collapsed).toBe('true');expect(host.querySelector('nav button')).toBe(page);expect(document.activeElement).toBe(toggle);
 await act(()=>page.click());expect(navigate).toHaveBeenCalledOnce();await act(()=>toggle.click());expect(toggle.getAttribute('aria-expanded')).toBe('true');expect(host.querySelector('nav button')).toBe(page);
 }finally{await act(()=>root.unmount());host.remove();}
});
