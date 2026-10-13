import test from 'node:test';import assert from 'node:assert/strict';import {startRuntime} from '../server.mjs';
test('vault secrets and replacement refuse callers without native approval authority',async()=>{
 const runtime=await startRuntime();
 try{const request=(route,body)=>fetch(runtime.url+'/'+route,{method:'POST',headers:{Authorization:'Bearer '+runtime.desktopToken,'Content-Type':'application/json'},body:JSON.stringify(body)});
 await request('unlock',{});
 for(const route of ['reveal','rotate'])assert.equal((await request(route,{id:'mail'})).status,403);
 }finally{await runtime.close();}
});
test('native session login creation is bounded, generates a password and removes without leaking it',async()=>{
 const r=await startRuntime();const call=(route,body,approved=true)=>fetch(r.url+'/'+route,{method:'POST',headers:{Authorization:'Bearer '+r.desktopToken,'Content-Type':'application/json',...(approved?{'X-Sentinel-Native-Action':r.nativeActionToken}:{})},body:JSON.stringify(body)});
 try{const login={name:'Local Notes',user:'owner@example.test',host:'notes.example.test'};
 assert.equal((await call('account-add',login,false)).status,403);
 assert.equal((await call('account-add',{...login,password:'no-secret-import'})).status,400);
 const added=await (await call('account-add',login)).json();assert.equal(added.ok,true);assert.match(added.id,/^account_[a-f0-9]{16}$/);
 const state=await (await call('state',{},false)).json();const account=state.accounts.find(a=>a.id===added.id);assert.equal(account.health,'Stronger');assert.ok(!Object.hasOwn(account,'password'));
 assert.equal((await call('account-add',login)).status,409);
 assert.equal((await call('account-add',{...login,user:login.user+' '})).status,409);
 assert.equal((await call('account-remove',{id:added.id},false)).status,403);
 assert.equal((await call('account-remove',{id:added.id})).status,200);
 assert.equal((await call('reveal',{id:added.id})).status,400);
 }finally{await r.close();}
});
