import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {webcrypto} from 'node:crypto';
import {gmailAdapter} from '../src/email/providers/gmail.js';import {outlookAdapter} from '../src/email/providers/outlook.js';
import {emailProvider,observeOpenedEmails} from '../src/email/extraction.js';import {emailExtractionLimits as limits} from '../data/email-extraction-config.js';
const require=createRequire(new URL('../../ui/package.json',import.meta.url));const {JSDOM}=require('jsdom');
async function eventually(predicate){const deadline=Date.now()+4000;while(!predicate()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(predicate(),'Expected observer state before deadline');}
async function fixture(provider='gmail',host=provider==='gmail'?'mail.google.com':'outlook.office.com'){
 const source=await readFile(new URL(`./fixtures/${provider}-open-email.html`,import.meta.url),'utf8');
 const dom=new JSDOM(source,{url:`https://${host}/`,pretendToBeVisual:true});return {dom,doc:dom.window.document,adapter:provider==='gmail'?gmailAdapter:outlookAdapter};
}
test('Gmail reads opened text, visible and actual links, attachment names and exposed headers',async()=>{
 const {dom,doc,adapter}=await fixture();try{const result=adapter.read(adapter.roots(doc)[0]);
 assert.equal(result.sender.address,'notice@sender.example.test');assert.equal(result.sender.name,'Example account team');assert.equal(result.subject,'Urgent account check');
 assert.equal(result.replyTo,'reply@other.example.test');assert.equal(result.authentication.spf,'fail');assert.equal(result.authentication.dkim,'pass');assert.equal(result.authentication.dmarc,'unavailable');
 assert.equal(result.links[0].text,'https://shown.example.test');assert.equal(result.links[0].destination,'https://actual.example.test/login');assert.deepEqual(result.attachments,['invoice.pdf.exe']);assert.doesNotMatch(result.body,/hidden content/);assert.equal(result.coverage,'partial');
 }finally{dom.window.close();}
});
test('Outlook adapter reads independently and leaves unavailable header data unknown',async()=>{
 const {dom,doc,adapter}=await fixture('outlook');try{const result=adapter.read(adapter.roots(doc)[0]);assert.equal(result.sender.address,'delivery@carrier.example.test');assert.equal(result.subject,'Delivery update');assert.equal(result.replyTo,null);assert.equal(result.availability.authentication,'unavailable');assert.deepEqual(result.attachments,['receipt.pdf']);}finally{dom.window.close();}
});
test('only exact supported HTTPS hosts select an adapter',async()=>{
 for(const host of ['mail.google.com.attacker.test','example.test']){const {dom,doc}=await fixture('gmail',host);try{assert.equal(emailProvider(doc),null);}finally{dom.window.close();}}
 for(const host of outlookAdapter.hosts){const {dom,doc}=await fixture('outlook',host);try{assert.equal(emailProvider(doc),outlookAdapter);}finally{dom.window.close();}}
});
test('body text cannot forge sender, Reply-To or authentication metadata',async()=>{
 const {dom,doc,adapter}=await fixture();try{
 doc.querySelector('header').remove();const body=doc.querySelector('.a3s');body.innerHTML='<span class="gD" email="forged@example.test">Bank</span><div class="ajA"><table><tr><td>SPF:</td><td>PASS</td></tr></table></div><span data-field="reply-to" email="forged@example.test">forged</span>hello';
 const result=adapter.read(adapter.roots(doc)[0]);assert.equal(result.sender.address,null);assert.equal(result.replyTo,null);assert.equal(result.authentication.spf,'unavailable');
 }finally{dom.window.close();}
});
test('hidden, collapsed and composer messages are not treated as opened incoming mail',async()=>{
 const {dom,doc,adapter}=await fixture();try{const root=doc.querySelector('.adn');root.hidden=true;assert.equal(adapter.roots(doc).length,0);root.hidden=false;root.setAttribute('contenteditable','true');assert.equal(adapter.roots(doc).length,0);}finally{dom.window.close();}
});
test('long text and excess links are bounded and explicitly truncated',async()=>{
 const {dom,doc,adapter}=await fixture();try{const body=doc.querySelector('.a3s');body.textContent='x'.repeat(limits.body+1000);
 for(let i=0;i<limits.links+5;i++){const link=doc.createElement('a');link.href=`https://example.test/${i}`;link.textContent='link';body.append(link);}
 const result=adapter.read(adapter.roots(doc)[0]);assert.ok(result.body.length<=limits.body);assert.equal(result.links.length,limits.links);assert.ok(result.truncated.includes('body'));assert.ok(result.truncated.includes('links'));
 }finally{dom.window.close();}
});
test('invalid and oversized link destinations remain unparsed instead of being approved',async()=>{
 const {dom,doc,adapter}=await fixture();try{doc.querySelector('a').setAttribute('href','https://example.test/'+'x'.repeat(limits.href));const result=adapter.read(adapter.roots(doc)[0]);assert.equal(result.links[0].destination,null);assert.ok(result.truncated.includes('links'));}finally{dom.window.close();}
});
test('missing layout gives unavailable rather than a clean email result',async()=>{
 const {dom,doc}=await fixture();const statuses=[];let reads=0;doc.querySelector('.a3s').remove();
 const control=observeOpenedEmails(doc,{crypto:webcrypto,onEmail:()=>reads++,onStatus:s=>statuses.push(s)});
 try{await control.ready;assert.equal(reads,0);assert.equal(statuses.at(-1).state,'unsupported_open_layout');}finally{control.stop();dom.window.close();}
});
test('SHA256 cache avoids duplicate analysis and changed text is reanalyzed',async()=>{
 const {dom,doc}=await fixture();let reads=0;const control=observeOpenedEmails(doc,{crypto:webcrypto,onEmail:()=>reads++});
 try{await control.ready;assert.equal(reads,1);await control.refresh();assert.equal(reads,1);doc.querySelector('.a3s').firstChild.nodeValue='Changed local text';await eventually(()=>reads===2);assert.equal(reads,2);}finally{control.stop();dom.window.close();}
});
test('stop while fingerprinting prevents stale callbacks and clears observer work',async()=>{
 const {dom,doc}=await fixture();let release,reads=0;const crypto={subtle:{digest:()=>new Promise(resolve=>{release=resolve;})}};
 const control=observeOpenedEmails(doc,{crypto,onEmail:()=>reads++});control.stop();release(new Uint8Array(32).buffer);await control.ready;assert.equal(reads,0);await control.refresh();assert.equal(reads,0);dom.window.close();
});
test('recycled nodes and changed href attributes invalidate the cache',async()=>{
 const {dom,doc}=await fixture();let reads=0;const control=observeOpenedEmails(doc,{crypto:webcrypto,onEmail:()=>reads++});
 try{await control.ready;doc.querySelector('a').href='https://changed.example.test/';await eventually(()=>reads===2);const root=doc.querySelector('.adn');root.remove();await control.refresh();await new Promise(resolve=>setTimeout(resolve,limits.debounceMs+20));await control.refresh();doc.querySelector('main').append(root);await eventually(()=>reads===3);}finally{control.stop();dom.window.close();}
});
test('provider reads do not mutate messages, click links or open attachments',async()=>{
 const {dom,doc,adapter}=await fixture();try{const before=doc.body.innerHTML;let clicks=0;doc.addEventListener('click',()=>clicks++);adapter.read(adapter.roots(doc)[0]);assert.equal(clicks,0);assert.equal(doc.body.innerHTML,before);}finally{dom.window.close();}
});
test('image-only messages are identified without reading image data',async()=>{
 const {dom,doc,adapter}=await fixture();try{const body=doc.querySelector('.a3s');body.replaceChildren(doc.createElement('img'));const result=adapter.read(adapter.roots(doc)[0]);assert.equal(result.imageOnly,true);assert.equal(result.body,'');}finally{dom.window.close();}
});
test('async consumers cannot render an old snapshot after a message changes',async()=>{
 const {dom,doc}=await fixture();let release,entered=false;const validity=[];
 const control=observeOpenedEmails(doc,{crypto:webcrypto,onEmail:async(_snapshot,_root,isCurrent)=>{if(!entered){entered=true;await new Promise(resolve=>release=resolve);}validity.push(isCurrent());}});
 try{await eventually(()=>entered);doc.querySelector('.a3s').firstChild.nodeValue='Changed while sender context was pending';await new Promise(resolve=>setTimeout(resolve,0));release();await control.ready;assert.equal(validity[0],false);await eventually(()=>validity.includes(true));}finally{control.stop();dom.window.close();}
});
test('unchanged messages regain link freshness after unrelated DOM updates without duplicate scoring',async()=>{
 const {dom,doc}=await fixture();let fresh,reads=0;const control=observeOpenedEmails(doc,{crypto:webcrypto,onEmail:(_snapshot,_root,isCurrent)=>{fresh=isCurrent;reads++;}});
 try{await control.ready;assert.equal(fresh(),true);const aside=doc.createElement('aside');aside.textContent='Sidebar changed';doc.body.append(aside);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(fresh(),false);await eventually(()=>fresh());assert.equal(reads,1);control.stop();assert.equal(fresh(),false);}finally{control.stop();dom.window.close();}
});
