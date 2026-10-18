import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mountMessageAi} from '../src/message-ai-inline.js';import {mountWhatsAppWarnings} from '../src/whatsapp-inline.js';
import {messageExcerpt} from '../src/message-ai-data.js';
const require=createRequire(new URL('../../ui/package.json',import.meta.url));const {JSDOM}=require('jsdom');
test('inline explanation uses safe text and opens only its finding',async()=>{
 const dom=new JSDOM('<article></article>'),root=dom.window.document.querySelector('article');let shadow;const original=dom.window.Element.prototype.attachShadow;dom.window.Element.prototype.attachShadow=function(o){shadow=original.call(this,o);return shadow;};const sent=[];
 const api={runtime:{sendMessage:async m=>{sent.push(m);return m.action==='explain'?{ref:'a'.repeat(32)}:m.action==='result'?{quick:{text:'<script>never execute this</script>'}}:{opened:true};}}};
 const cleanup=mountMessageAi(root,'Urgent! Send your OTP 123456 now.',api);try{await new Promise(ok=>setTimeout(ok,30));assert.ok(!sent[0].text.includes('123456'));assert.equal(shadow.querySelector('script'),null);assert.match(shadow.textContent,/never execute/);shadow.querySelector('button').click();await new Promise(ok=>setTimeout(ok,10));assert.deepEqual(sent.at(-1),{kind:'message_ai',action:'open',ref:'a'.repeat(32)});}finally{cleanup();assert.equal(root.children.length,0);dom.window.close();}
});
test('WhatsApp flags a supported incoming message once and cleans AI up after an edit',async()=>{
 const dom=new JSDOM('<div class="message-in"><div data-pre-plain-text=""><span class="selectable-text">Urgent! Your account will be closed. Send your password now. https://bit.ly/claim</span></div></div>');let calls=0;
 const api={runtime:{sendMessage:async m=>{if(m.action==='explain'){calls++;return {ref:'b'.repeat(32)};}return {quick:{text:'Verify the request separately.'}};}}};
 const mounted=mountWhatsAppWarnings(dom.window.document,api);try{await new Promise(ok=>setTimeout(ok,30));assert.equal(calls,1);mounted.refresh();assert.equal(calls,1);dom.window.document.querySelector('.selectable-text').textContent='Hello, see you tomorrow.';mounted.refresh();assert.equal(dom.window.document.querySelectorAll('[data-sentinel-flagged]').length,0);}finally{mounted.stop();dom.window.close();}
});
test('outgoing WhatsApp text never starts AI and excerpts strip common secrets',()=>{
 const dom=new JSDOM('<div class="message-out"><div data-pre-plain-text=""><span class="selectable-text">Urgent! Send your password now.</span></div></div>');let calls=0;const mount=mountWhatsAppWarnings(dom.window.document,{runtime:{sendMessage:()=>{calls++;}}});try{assert.equal(calls,0);}finally{mount.stop();dom.window.close();}
 assert.equal(messageExcerpt('Visit https://user:pass@example.test/path?token=secret#secret; OTP: 123456').includes('secret'),false);
});
import {startEmailWarnings} from '../src/email/runtime.js';
import {readFile} from 'node:fs/promises';
test('opened Gmail and Outlook warnings get an AI explanation with cleanup and no extraction loop',async()=>{
 for(const provider of ['gmail','outlook']){
  const html=await readFile(new URL('./fixtures/'+(provider==='gmail'?'gmail-open-email':'outlook-open-email')+'.html',import.meta.url),'utf8');const dom=new JSDOM(html,{pretendToBeVisual:true,url:provider==='gmail'?'https://mail.google.com/':'https://outlook.live.com/'}),doc=dom.window.document;
  const body=doc.querySelector(provider==='gmail'?'.a3s':'[role=document]');body.textContent='Urgent! Your account will be closed. Send your password now. https://bit.ly/claim';let requests=0;
  const api={runtime:{onMessage:{addListener(){},removeListener(){}},sendMessage:async m=>{if(m.kind==='email_status')return {enabled:true};if(m.kind==='email_context')return {};if(m.kind==='message_ai'&&m.action==='explain'){requests++;return {ref:'c'.repeat(32)};}if(m.kind==='message_ai')return {quick:{text:'Verify the request separately.'}};return {};}}};
  let cleanup;try{cleanup=await startEmailWarnings(doc,api);await new Promise(ok=>setTimeout(ok,650));assert.equal(requests,1,provider+' must not repeatedly submit its own UI');assert.equal(body.querySelectorAll('[data-sentinel-ai]').length,1);}finally{cleanup?.();assert.equal(doc.querySelectorAll('[data-sentinel-ai]').length,0);dom.window.close();}
 }
});
test('temporary email revalidation pauses polling without losing the explanation',async()=>{
 const dom=new JSDOM('<article></article>'),root=dom.window.document.querySelector('article');let current=false,shadow;const attach=dom.window.Element.prototype.attachShadow;dom.window.Element.prototype.attachShadow=function(o){shadow=attach.call(this,o);return shadow;};let polls=0;
 const cleanup=mountMessageAi(root,'Urgent! Send your password now.',{runtime:{sendMessage:async m=>m.action==='explain'?{ref:'d'.repeat(32)}:(polls++,{quick:{text:'Verify separately.'}})}},{isCurrent:()=>current});try{await new Promise(ok=>setTimeout(ok,20));assert.equal(polls,0);current=true;await new Promise(ok=>setTimeout(ok,1100));assert.equal(polls,1);assert.match(shadow.textContent,/Verify separately/);}finally{cleanup();dom.window.close();}
});
test('a failed desktop connection offers a retry without resubmitting another message',async()=>{
 const dom=new JSDOM('<article></article>'),root=dom.window.document.querySelector('article');let shadow,online=false;const attach=dom.window.Element.prototype.attachShadow;dom.window.Element.prototype.attachShadow=function(o){shadow=attach.call(this,o);return shadow;};
 const cleanup=mountMessageAi(root,'Urgent! Send your password now.',{runtime:{sendMessage:async m=>!online?{error:'connection_unavailable',message:'The desktop connector could not connect.'}:m.action==='explain'?{ref:'e'.repeat(32)}:{quick:{text:'Verify separately.'}}}});
 try{await new Promise(ok=>setTimeout(ok,20));assert.equal(shadow.querySelector('button').textContent,'Try again');online=true;shadow.querySelector('button').click();await new Promise(ok=>setTimeout(ok,20));assert.match(shadow.textContent,/Verify separately/);assert.equal(shadow.querySelector('button').textContent,'Learn more');}finally{cleanup();dom.window.close();}
});
