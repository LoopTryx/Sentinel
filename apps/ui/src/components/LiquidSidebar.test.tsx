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

it('collapsed glass tooltip escapes the scrollport and preserves navigation, aria descriptions and cleanup',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),navigate=vi.fn();let intersect:(entries:any[])=>void=()=>{},disconnected=0,hidden=false;
 let tooltipResize=()=>{},tipObservers=0,tipDisconnections=0,rectRight=88;vi.stubGlobal('ResizeObserver',class{constructor(fn:()=>void){tooltipResize=fn;tipObservers++;}observe(){}disconnect(){tipDisconnections++;}});
 vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);
 vi.stubGlobal('IntersectionObserver',class{constructor(fn:any){intersect=fn;}observe(){}disconnect(){disconnected++;}});
 function Demo(){const [collapsed,setCollapsed]=useState(true);return <LiquidSidebar collapsed={collapsed} onToggle={()=>setCollapsed(value=>!value)}><nav><button className="nav-btn" aria-label="Scan & Detect" onClick={navigate}>Scan & Detect</button></nav></LiquidSidebar>;}
 try{await act(()=>root.render(<Demo/>));const page=host.querySelector('nav button') as HTMLButtonElement,aside=host.querySelector('aside')!;
  vi.spyOn(page,'getBoundingClientRect').mockImplementation(()=>({left:34,right:rectRight,top:100,bottom:150,width:rectRight-34,height:50,x:34,y:100,toJSON(){}}));
  page.setAttribute('aria-describedby','existing-hint');await act(()=>page.focus());const tip=document.body.querySelector('[role=tooltip]')!;expect(tip.textContent).toBe('Scan & Detect');expect(aside.contains(tip)).toBe(false);expect(page.getAttribute('aria-describedby')).toBe(tip.id);
  expect((tip as HTMLElement).style.left).toBe('100px');rectRight=120;await act(()=>tooltipResize());expect((document.querySelector('[role=tooltip]') as HTMLElement).style.left).toBe('132px');
  await act(()=>document.dispatchEvent(new Event('scroll')));expect(document.querySelector('[role=tooltip]')).toBeNull();expect(page.getAttribute('aria-describedby')).toBe('existing-hint');
  await act(()=>page.dispatchEvent(new MouseEvent('pointerover',{bubbles:true})));expect(document.querySelector('[role=tooltip]')).not.toBeNull();await act(()=>page.click());expect(navigate).toHaveBeenCalledOnce();expect(document.querySelector('[role=tooltip]')).toBeNull();
  hidden=true;await act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(aside.dataset.motionPaused).toBe('true');hidden=false;await act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(aside.dataset.motionPaused).toBe('false');
  intersect([{isIntersecting:false}]);expect(aside.dataset.motionPaused).toBe('true');intersect([{isIntersecting:true}]);expect(aside.dataset.motionPaused).toBe('false');
  await act(()=>page.dispatchEvent(new MouseEvent('pointerover',{bubbles:true})));expect(document.querySelector('[role=tooltip]')).not.toBeNull();await act(()=>host.querySelector<HTMLButtonElement>('.sidebar-toggle')!.click());expect(document.querySelector('[role=tooltip]')).toBeNull();expect(page.getAttribute('aria-describedby')).toBe('existing-hint');expect(host.querySelector('nav button')).toBe(page);
  const toggle=host.querySelector<HTMLButtonElement>('.sidebar-toggle')!;await act(()=>toggle.click());await act(()=>toggle.focus());expect(document.querySelector('[role=tooltip]')?.textContent).toBe('Expand navigation');expect(toggle.getAttribute('aria-expanded')).toBe('false');
 }finally{await act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();}
 expect(disconnected).toBe(1);expect(tipDisconnections).toBe(tipObservers);expect(document.querySelector('[role=tooltip]')).toBeNull();
});

it('exposes hover expansion while preserving the same navigation',async()=>{const host=document.createElement('div'),root=createRoot(host);try{await act(()=>root.render(<LiquidSidebar collapsed={true} onToggle={()=>{}}><nav>Pages</nav></LiquidSidebar>));expect(host.querySelector('aside')?.dataset.hoverExpand).toBe('true');}finally{await act(()=>root.unmount());}});
