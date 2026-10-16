// @vitest-environment jsdom
import {act,StrictMode} from 'react';import {createRoot} from 'react-dom/client';import {expect,it,vi} from 'vitest';
import GradientASCII from './components/ui/GradientASCII';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('bounds render pixels and draw rate, pauses hidden/offscreen/reduced-motion, and cleans WebGL resources',async()=>{
 const gl:any={LINK_STATUS:1,ACTIVE_UNIFORMS:2};
 for(const name of ['createShader','createProgram','createVertexArray','createTexture','createFramebuffer'])gl[name]=vi.fn(()=>({}));
 for(const name of ['shaderSource','compileShader','deleteShader','attachShader','linkProgram','deleteProgram','bindVertexArray','bindTexture','texParameteri','texImage2D','bindFramebuffer','framebufferTexture2D','viewport','useProgram','uniform2f','uniform1f','uniform1i','uniform3fv','uniform4fv','activeTexture','drawArrays','deleteVertexArray','deleteTexture','deleteFramebuffer','drawBuffers','generateMipmap','pixelStorei','disable'])gl[name]=vi.fn();
 gl.getShaderParameter=()=>true;gl.getProgramParameter=(_:unknown,p:number)=>p===gl.LINK_STATUS?true:0;const lose=vi.fn();gl.getExtension=()=>({loseContext:lose});
 const frames=new Map<number,FrameRequestCallback>();let next=0,hidden=false,intersect:(entries:any[])=>void=()=>{},motionChange=()=>{};
 const motion={matches:false,addEventListener:(_:unknown,fn:()=>void)=>motionChange=fn,removeEventListener:vi.fn()};
 vi.stubGlobal('requestAnimationFrame',vi.fn((cb:FrameRequestCallback)=>{frames.set(++next,cb);return next;}));vi.stubGlobal('cancelAnimationFrame',vi.fn((id:number)=>frames.delete(id)));
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('IntersectionObserver',class{constructor(cb:any){intersect=cb;}observe(){}disconnect(){}});
 vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(20000);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(10000);
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(((kind:string)=>kind==='webgl2'?gl:null) as any);window.matchMedia=vi.fn().mockReturnValue(motion);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const step=(time:number)=>{const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(time));};
 try{
  await act(()=>root.render(<StrictMode><GradientASCII maxFps={24} mouseInteraction={false} clickEffect="none"/></StrictMode>));const canvas=host.querySelector('canvas')!;expect(canvas.width*canvas.height).toBeLessThanOrEqual(1502000);expect(Math.max(canvas.width,canvas.height)).toBeLessThanOrEqual(4096);
  gl.drawArrays.mockClear();step(0);expect(gl.drawArrays).toHaveBeenCalledTimes(5);step(16);step(32);expect(gl.drawArrays).toHaveBeenCalledTimes(5);step(48);expect(gl.drawArrays).toHaveBeenCalledTimes(10);
  hidden=true;document.dispatchEvent(new Event('visibilitychange'));expect(frames.size).toBe(0);const draws=gl.drawArrays.mock.calls.length;
  await act(()=>root.render(<StrictMode><GradientASCII colors={['#9f1239','#fff1f2']} maxFps={24} mouseInteraction={false} clickEffect="none"/></StrictMode>));expect(gl.drawArrays).toHaveBeenCalledTimes(draws);
  hidden=false;document.dispatchEvent(new Event('visibilitychange'));expect(frames.size).toBe(1);intersect([{isIntersecting:false}]);expect(frames.size).toBe(0);intersect([{isIntersecting:true}]);expect(frames.size).toBe(1);
  motion.matches=true;motionChange();step(100);expect(frames.size).toBe(0);
  canvas.dispatchEvent(new Event('webglcontextlost'));expect(canvas.style.opacity).toBe('0');expect(frames.size).toBe(0);
 }finally{await act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();}
 expect(frames.size).toBe(0);expect(gl.deleteProgram).toHaveBeenCalledTimes(8);expect(gl.deleteTexture).toHaveBeenCalledTimes(10);expect(gl.deleteFramebuffer).toHaveBeenCalledTimes(6);expect(lose).not.toHaveBeenCalled();
});
it('keeps a static gradient fallback when WebGL is unavailable',async()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(()=>root.render(<GradientASCII/>));expect(host.firstElementChild?.getAttribute('style')).toContain('radial-gradient');expect(host.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');}finally{await act(()=>root.unmount());host.remove();vi.restoreAllMocks();}
});
