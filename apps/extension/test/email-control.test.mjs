import test from 'node:test';import assert from 'node:assert/strict';
import {installEmailControl} from '../src/email/control.js';
function harness(){let listener;const saved={},scripts=[];let grant=false;
 const api={runtime:{id:'unit',getURL:p=>`chrome-extension://unit/${p}`,onMessage:{addListener:f=>listener=f}},storage:{local:{setAccessLevel:async()=>{},get:async key=>({[key]:saved[key]}),set:async value=>Object.assign(saved,value)}},permissions:{contains:async()=>grant},scripting:{getRegisteredContentScripts:async()=>scripts,registerContentScripts:async value=>scripts.push(...value),unregisterContentScripts:async()=>scripts.splice(0),executeScript:async()=>{}},tabs:{query:async()=>[],sendMessage:async()=>{}}};
 installEmailControl(api);return {saved,scripts,grant:()=>grant=true,call:(message,sender)=>new Promise(resolve=>{if(!listener(message,{id:'unit',...sender},resolve))resolve(null);})};
}
const popup={url:'chrome-extension://unit/popup.html'},content={url:'https://mail.google.com/mail/u/0/',frameId:0,tab:{id:3}};
test('email requires explicit popup opt-in and permission; registered scripts are top-frame only',async()=>{
 const h=harness();assert.deepEqual(await h.call({kind:'email_status',provider:'gmail'},popup),{enabled:false});
 assert.ok((await h.call({kind:'email_toggle',provider:'gmail',enabled:true},popup)).error);assert.equal(h.scripts.length,0);
 h.grant();assert.deepEqual(await h.call({kind:'email_toggle',provider:'gmail',enabled:true},popup),{enabled:true});
 assert.equal(h.scripts[0].allFrames,false);assert.deepEqual(h.scripts[0].matches,['https://mail.google.com/*']);
 await h.call({kind:'email_toggle',provider:'gmail',enabled:false},popup);assert.equal(h.scripts.length,0);
});
test('content cannot trust senders, submit bodies, impersonate popup or use an unsupported host',async()=>{
 const h=harness();h.grant();await h.call({kind:'email_toggle',provider:'gmail',enabled:true},popup);
 assert.ok((await h.call({kind:'email_trust',address:'person@example.test'},content)).error);
 assert.ok((await h.call({kind:'email_context',address:'person@example.test',body:'private'},content)).error);
 assert.equal(await h.call({kind:'email_context',address:'person@example.test'},{...content,url:'https://mail.google.com.attacker.test/'}),null);
 assert.equal(await h.call({kind:'email_context',address:'person@example.test'},{...content,frameId:1}),null);
 const result=await h.call({kind:'email_context',address:'person@example.test'},content);assert.equal(result.firstTime,true);assert.equal(result.trusted,false);
 assert.ok(!JSON.stringify(h.saved).includes('private'));
 assert.deepEqual(await h.call({kind:'email_feedback',tier:'Suspicious'},content),{recorded:true});assert.equal(h.saved.emailWrongFlagCount,1);
 assert.ok((await h.call({kind:'email_feedback',tier:'Suspicious',body:'private'},content)).error);
 assert.deepEqual(await h.call({kind:'email_reader_status',state:'unsupported_open_layout',messages:0},content),{recorded:true});
 assert.equal((await h.call({kind:'email_status',provider:'gmail'},popup)).reader,'unsupported_open_layout');
 assert.ok((await h.call({kind:'email_reader_status',state:'partial',messages:9},content)).error);
 assert.ok((await h.call({kind:'email_reader_status',state:'partial',messages:1,body:'private'},content)).error);
});
