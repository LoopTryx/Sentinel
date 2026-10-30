// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
it('accepts an empty status error and still rejects an actual native error',async()=>{
 vi.resetModules();let handler:((event:{data:unknown})=>void)|undefined;let reply:unknown={available:true,error:'',signatures:3628111};
 Object.defineProperty(window,'chrome',{configurable:true,value:{webview:{addEventListener:(_kind:string,next:typeof handler)=>{handler=next;},postMessage:(raw:string)=>{const request=JSON.parse(raw);handler?.({data:{id:request.id,data:reply}});}}}});
 try{const {demoCall}=await import('./demo-bridge');await expect(demoCall('security.status')).resolves.toMatchObject({available:true,signatures:3628111});reply={supported:true,available:true,error:'Some download events were missed. Checking recent downloads again.',scan:{state:'scanning',checkedFiles:7}};await expect(demoCall('security.status')).resolves.toMatchObject({available:true,scan:{checkedFiles:7}});reply={error:'Scanner unavailable'};await expect(demoCall('security.scan',{mode:'quick'})).rejects.toThrow('Scanner unavailable');}finally{delete (window as any).chrome;}
});
