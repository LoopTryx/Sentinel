// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';
const animation=vi.hoisted(()=>({ticks:new Set<(...args:number[])=>void>(),to:vi.fn(),kill:vi.fn()}));
vi.mock('gsap',()=>({gsap:{ticker:{add:(fn:(...args:number[])=>void)=>animation.ticks.add(fn),remove:(fn:(...args:number[])=>void)=>animation.ticks.delete(fn)},to:animation.to,killTweensOf:animation.kill}}));
import TextLoop from './components/ui/TextLoop';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('ribbon pauses for hover/keyboard/visibility/offscreen/reduced motion, supports drag and cleans ticker/capture',async()=>{
 const proto=SVGElement.prototype as any,oldLength=proto.getTotalLength,oldText=proto.getComputedTextLength;
 proto.getTotalLength=()=>1840;proto.getComputedTextLength=()=>200;
 let intersect:(entries:any[])=>void=()=>{},motionChange=()=>{},hidden=false;
 const motion={matches:false,addEventListener:(_:unknown,fn:()=>void)=>motionChange=fn,removeEventListener:vi.fn()};window.matchMedia=vi.fn().mockReturnValue(motion);
 vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);vi.stubGlobal('IntersectionObserver',class{constructor(cb:any){intersect=cb;}observe(){intersect([{isIntersecting:true}]);}disconnect(){}});
 animation.ticks.clear();animation.to.mockImplementation((target:any,options:any)=>{target.scale=options.scale;options.onComplete?.();return {};});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let release=vi.fn();
 try{
  await act(()=>root.render(<TextLoop text="Sentinel" shape="line" speed={135} draggable pauseOnHover ribbonWidth={76}/>));
  const region=host.querySelector('[role=group]') as HTMLElement,svg=host.querySelector('svg')!,head=host.querySelector('textPath')!;
  expect(svg.getAttribute('viewBox')).toBe('0 212 1200 96');expect(animation.ticks.size).toBe(1);
  const before=head.getAttribute('startOffset');for(const tick of [...animation.ticks]){tick(0,16);tick(0,16);}expect(head.getAttribute('startOffset')).toBe(before);for(const tick of [...animation.ticks])tick(0,16);expect(head.getAttribute('startOffset')).not.toBe(before);
  region.dispatchEvent(new Event('pointerenter'));expect(animation.ticks.size).toBe(0);region.dispatchEvent(new Event('pointerleave'));expect(animation.ticks.size).toBe(1);
  region.focus();expect(animation.ticks.size).toBe(0);const offset=Number(head.getAttribute('startOffset'));region.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));expect(Number(head.getAttribute('startOffset'))).toBeCloseTo(offset+40);
  region.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));expect(animation.ticks.size).toBe(1);
  hidden=true;document.dispatchEvent(new Event('visibilitychange'));expect(animation.ticks.size).toBe(0);hidden=false;document.dispatchEvent(new Event('visibilitychange'));expect(animation.ticks.size).toBe(1);
  intersect([{isIntersecting:false}]);expect(animation.ticks.size).toBe(0);intersect([{isIntersecting:true}]);expect(animation.ticks.size).toBe(1);
  motion.matches=true;motionChange();expect(animation.ticks.size).toBe(0);motion.matches=false;motionChange();expect(animation.ticks.size).toBe(1);
  Object.assign(svg,{getScreenCTM:()=>({a:2,b:0})});
  Object.assign(region,{setPointerCapture:vi.fn(),hasPointerCapture:()=>true,releasePointerCapture:release});
  const pointer=(type:string,x:number)=>{const event=new MouseEvent(type,{clientX:x,clientY:0,bubbles:true});Object.defineProperty(event,'pointerId',{value:1});Object.defineProperty(event,'pointerType',{value:'mouse'});region.dispatchEvent(event);};
  const preDrag=Number(head.getAttribute('startOffset'));pointer('pointerdown',10);expect(animation.ticks.size).toBe(0);pointer('pointermove',60);expect(Number(head.getAttribute('startOffset'))).toBeCloseTo(preDrag+25);
 }finally{await act(()=>root.unmount());host.remove();if(oldLength)proto.getTotalLength=oldLength;else delete proto.getTotalLength;if(oldText)proto.getComputedTextLength=oldText;else delete proto.getComputedTextLength;vi.restoreAllMocks();vi.unstubAllGlobals();}
 expect(animation.ticks.size).toBe(0);expect(release).toHaveBeenCalledWith(1);expect(animation.kill).toHaveBeenCalled();
});

it('fits line SVG to CSS width without scaling small type, updates on resize and releases observer',async()=>{
 const proto=SVGElement.prototype as any,oldLength=proto.getTotalLength,oldText=proto.getComputedTextLength;let width=1000,resize=()=>{},disconnected=0;
 proto.getTotalLength=()=>width+640;proto.getComputedTextLength=()=>120;
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({width,height:58,left:0,top:0,right:width,bottom:58,x:0,y:0,toJSON(){}}));
 vi.stubGlobal('ResizeObserver',class{constructor(cb:()=>void){resize=cb;}observe(){}disconnect(){disconnected++;}});
 vi.stubGlobal('IntersectionObserver',class{observe(){}disconnect(){}});window.matchMedia=vi.fn().mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(()=>root.render(<TextLoop fitWidth text="Sentinel" shape="line" fontSize={22} ribbonWidth={38}/>));
  const svg=host.querySelector('svg')!;expect(svg.getAttribute('viewBox')).toBe('0 231 1000 58');expect(host.querySelector('text')?.style.fontSize).toBe('22px');
  width=3000;await act(()=>resize());expect(svg.getAttribute('viewBox')).toBe('0 231 3000 58');expect(host.querySelector('text')?.style.fontSize).toBe('22px');
 }finally{await act(()=>root.unmount());host.remove();if(oldLength)proto.getTotalLength=oldLength;else delete proto.getTotalLength;if(oldText)proto.getComputedTextLength=oldText;else delete proto.getComputedTextLength;vi.restoreAllMocks();vi.unstubAllGlobals();}
 expect(disconnected).toBe(1);
});
