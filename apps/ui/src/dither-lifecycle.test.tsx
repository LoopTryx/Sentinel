// @vitest-environment jsdom
import {act,StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import Dither from './components/ui/Dither';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;

it('caps draws, stops hidden/offscreen work and releases the replacement WebGL resources',async()=>{
 const gl:any={LINK_STATUS:1,ACTIVE_UNIFORMS:2,MAX_TEXTURE_SIZE:3};
 for(const name of ['createShader','createProgram','createBuffer','createVertexArray','createTexture','createFramebuffer'])gl[name]=vi.fn(()=>({}));
 for(const name of ['shaderSource','compileShader','deleteShader','attachShader','bindAttribLocation','linkProgram','deleteProgram','bindVertexArray','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','bindTexture','texParameteri','texImage2D','bindFramebuffer','framebufferTexture2D','viewport','useProgram','uniform2f','uniform1f','uniform1i','uniform3fv','uniform4fv','activeTexture','uniform2i','drawArrays','deleteBuffer','deleteVertexArray','deleteTexture','deleteFramebuffer'])gl[name]=vi.fn();
 let contextLost=false;const lose=vi.fn(()=>{contextLost=true;});gl.getShaderParameter=()=>!contextLost;gl.getProgramParameter=(_:unknown,p:number)=>p===gl.LINK_STATUS?true:0;gl.getParameter=()=>4096;gl.getExtension=()=>({loseContext:lose});
 const frames=new Map<number,FrameRequestCallback>();let next=0,hidden=false;let intersect:(entries:any[])=>void=()=>{};
 vi.stubGlobal('requestAnimationFrame',vi.fn((cb:FrameRequestCallback)=>{frames.set(++next,cb);return next;}));
 vi.stubGlobal('cancelAnimationFrame',vi.fn((id:number)=>frames.delete(id)));
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 vi.stubGlobal('IntersectionObserver',class{constructor(cb:any){intersect=cb;}observe(){}disconnect(){}});
 vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(((kind:string)=>kind==='webgl2'?gl:null) as any);
 window.matchMedia=vi.fn().mockReturnValue({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const step=(time:number)=>{const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(time));};
 try{
  await act(()=>root.render(<StrictMode><Dither maxFps={24}/></StrictMode>));gl.drawArrays.mockClear();
  step(0);expect(gl.drawArrays).toHaveBeenCalledTimes(2);step(16);step(32);expect(gl.drawArrays).toHaveBeenCalledTimes(2);step(48);expect(gl.drawArrays).toHaveBeenCalledTimes(4);
  hidden=true;document.dispatchEvent(new Event('visibilitychange'));expect(frames.size).toBe(0);const draws=gl.drawArrays.mock.calls.length;
  await act(()=>root.render(<StrictMode><Dither waveColor={[1,0,0]} maxFps={24}/></StrictMode>));expect(gl.drawArrays).toHaveBeenCalledTimes(draws);
  hidden=false;document.dispatchEvent(new Event('visibilitychange'));expect(frames.size).toBe(1);
  intersect([{isIntersecting:false}]);expect(frames.size).toBe(0);intersect([{isIntersecting:true}]);expect(frames.size).toBe(1);
 }finally{await act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();}
 expect(frames.size).toBe(0);expect(gl.deleteProgram).toHaveBeenCalledTimes(4);expect(gl.deleteTexture).toHaveBeenCalledTimes(2);expect(gl.deleteFramebuffer).toHaveBeenCalledTimes(2);expect(lose).not.toHaveBeenCalled();
});
