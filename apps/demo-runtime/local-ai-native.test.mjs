import {test} from 'node:test';import assert from 'node:assert/strict';
import {startRuntime} from './server.mjs';
test('real CPU model through authenticated desktop route, with browser return and clean shutdown',{skip:process.env.SENTINEL_LOCAL_AI_ACCEPTANCE!=='1',timeout:60000},async()=>{
 const runtime=await startRuntime();
 const post=(path,token,body,headers={})=>fetch(runtime.url+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{
  const id='d'.repeat(32);const browser=await (await post('/pair',runtime.desktopToken,{extensionId:id})).json();
  assert.equal((await post('/ai-quick',browser.token,{question:'Hi',findingRef:null},{'X-Sentinel-Extension':id})).status,403);
  const handoff=await (await post('/ai-handoff',browser.token,{url:'https://example.test/winner-payment',question:'Why is this concerning?',nonce:'a'.repeat(32)},{'X-Sentinel-Extension':id})).json();
  const response=await post('/ai-quick',runtime.desktopToken,{question:'Explain this link.',findingRef:handoff.finding.ref});assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.provider,'On device');assert.equal(result.kind,'local_interpretation');assert.ok(result.text.length>0&&result.text.length<=2000);
  const returned=await (await post('/ai-result',browser.token,{ref:handoff.finding.ref},{'X-Sentinel-Extension':id})).json();assert.deepEqual(returned.quick,result);assert.equal(returned.result,null);
  console.log('Real CPU reply elapsedMs='+result.elapsedMs+'; NVIDIA was not called.');
 }finally{await runtime.close();}
});

test('flagged message source and excerpt reach the real local model and return through browser result',{skip:process.env.SENTINEL_LOCAL_AI_ACCEPTANCE!=='1',timeout:60000},async()=>{
 const runtime=await startRuntime({localExplanations:true});const id='e'.repeat(32);
 const post=(path,token,body,headers={})=>fetch(runtime.url+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{
  const browser=await (await post('/pair',runtime.desktopToken,{extensionId:id})).json();
  const handoff=await (await post('/ai-message',browser.token,{source:'gmail',text:'Urgent! Your account will close. Send your password and verification code now. https://bit.ly/claim',nonce:'b'.repeat(32)},{'X-Sentinel-Extension':id})).json();
  assert.equal(handoff.finding.source,'gmail_message');assert.ok(handoff.finding.signals.some(s=>s.code==='message_excerpt'));
  let browserReply;const started=Date.now();
  for(let attempt=0;attempt<60;attempt++){browserReply=await (await post('/ai-result',browser.token,{ref:handoff.finding.ref},{'X-Sentinel-Extension':id})).json();if(browserReply.quick)break;if(browserReply.localError)throw Error(browserReply.localError);await new Promise(ok=>setTimeout(ok,200));}
  const reply=browserReply.quick;assert.equal(reply?.provider,'On device');assert.ok(reply.text.length>0);assert.equal(browserReply.result,null);
  assert.ok(Date.now()-started<15000);
  console.log('Synthetic Gmail -> actual CPU model: '+reply.text+' ('+reply.elapsedMs+'ms); No desktop inbox/quick call; NVIDIA not called.');
 }finally{await runtime.close();}
});

test('cancelling a queued message does not interrupt another local explanation',{skip:process.env.SENTINEL_LOCAL_AI_ACCEPTANCE!=='1',timeout:60000},async()=>{
 const runtime=await startRuntime({localExplanations:true}),id='f'.repeat(32);
 const post=(path,token,body,headers={})=>fetch(runtime.url+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{
  const browser=await (await post('/pair',runtime.desktopToken,{extensionId:id})).json(),headers={'X-Sentinel-Extension':id};
  const first=await (await post('/ai-message',browser.token,{source:'whatsapp',text:'Urgent! Your account will close. Send your password now.',nonce:'c'.repeat(32)},headers)).json();
  const second=await (await post('/ai-message',browser.token,{source:'whatsapp',text:'Urgent prize! Pay a fee now to collect the reward.',nonce:'d'.repeat(32)},headers)).json();
  assert.equal((await post('/ai-quick-cancel',runtime.desktopToken,{findingRef:second.finding.ref})).status,200);
  let a,b;for(let n=0;n<70;n++){a=await(await post('/ai-result',browser.token,{ref:first.finding.ref},headers)).json();b=await(await post('/ai-result',browser.token,{ref:second.finding.ref},headers)).json();if(a.quick&&b.localError)break;await new Promise(ok=>setTimeout(ok,200));}
  assert.equal(a.quick?.provider,'On device');assert.equal(a.localError,null);assert.equal(b.quick,null);assert.equal(b.localError,'local_cancelled_or_timed_out');
 }finally{await runtime.close();}
});

// Real CPU inference and authenticated transport, separate from installed Chrome acceptance.
test('contextual message screening reaches desktop only for a likely local verdict',{skip:process.env.SENTINEL_CONTEXT_AI_ACCEPTANCE!=='1',timeout:90000},async()=>{
 const runtime=await startRuntime({localExplanations:true}),id='a'.repeat(32);
 const post=async(path,token,body,headers={})=>{const response=await fetch(runtime.url+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 try{const browser=(await post('/pair',runtime.desktopToken,{extensionId:id})).data,headers={'X-Sentinel-Extension':id};
 assert.equal((await post('/ai-chat',browser.token,{question:'Hi',findingRef:null},headers)).status,403);
 const row=(await post('/ai-message',browser.token,{source:'gmail',text:'You won an unsolicited lottery prize. Send a gift card code to pay the release fee.',history:['I did not enter a lottery.'],nonce:'c'.repeat(32)},headers)).data;
 assert.equal((await post('/ai-inbox',runtime.desktopToken,{})).data.handoff,null);
 let result;for(let i=0;i<120;i++){result=(await post('/ai-result',browser.token,{ref:row.finding.ref},headers)).data;if(result.quick||result.localError)break;await new Promise(ok=>setTimeout(ok,250));}
 assert.equal(result.quick?.verdict,'likely');assert.equal(result.result,null);assert.match(result.quick.model,/Qwen/);
 const received=(await post('/ai-inbox',runtime.desktopToken,{})).data.handoff;assert.equal(received.finding.ref,row.finding.ref);assert.ok(received.finding.signals.some(s=>s.code==='message_context'&&s.text.includes('did not enter')));
 console.log('PASS actual CPU likely verdict, browser return, native inbox and prior-message context; no NVIDIA request');
 }finally{await runtime.close();}
});
