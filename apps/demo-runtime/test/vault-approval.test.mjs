import test from 'node:test';import assert from 'node:assert/strict';import {startRuntime} from '../server.mjs';
test('vault secrets and replacement refuse callers without native approval authority',async()=>{
 const runtime=await startRuntime();
 try{const request=(route,body)=>fetch(runtime.url+'/'+route,{method:'POST',headers:{Authorization:'Bearer '+runtime.desktopToken,'Content-Type':'application/json'},body:JSON.stringify(body)});
 await request('unlock',{});
 for(const route of ['reveal','rotate'])assert.equal((await request(route,{id:'mail'})).status,403);
 }finally{await runtime.close();}
});
