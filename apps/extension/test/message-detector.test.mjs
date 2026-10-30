import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {assessMessage,normalizeMessage} from '../src/message-detector.js';
import {messageDetectorConfig as config} from '../data/message-detector-config.js';
import {mountWhatsAppWarnings} from '../src/whatsapp-inline.js';
import {createMessageFeedback} from '../src/message-feedback.js';
const require=createRequire(new URL('../../ui/package.json',import.meta.url));
const {JSDOM}=require('jsdom'); // Reuse the workspace's pinned test-only runtime; no shipped dependency.

test('single category, repeated keyword, link and sender metadata never flag alone',()=>{
 for(const text of ['prize','urgent','password','win','scam','prize '.repeat(100),'https://paypa1.com','+1 202 555 0100','$500'])
  for(const context of [{},{senderStatus:'unsaved',firstTime:true,foreignCountryCode:true},{senderStatus:'saved'}])assert.equal(assessMessage(text,context).risk,'unknown',text);
});
test('normalization supports mixed scripts, diacritics, emoji and leetspeak without losing valid double letters',()=>{
 assert.equal(normalizeMessage('🔥 URRRgent!!! P@SSW0RD   رمزُ التحقق ١٢٣'),'urgent password رمز التحقق l23');
 for(const text of ['🔥 URGENT cl@im your priiiize','عاجل أرسل رمز التحقق','Claim جائزة immediately https://tinyurl.com/gift','Send your p@ssw0rd immediately'])assert.equal(assessMessage(text).risk,'suspicious');
});
test('weighted combinations, proximity and content limits are enforced',()=>{
 const close=assessMessage('prize claim urgent'),far=assessMessage(`prize ${'hello '.repeat(20)}claim ${'hello '.repeat(20)}urgent`);
 assert.ok(close.score>far.score);
 assert.ok(close.categories.length>=2);
 assert.equal(assessMessage('urgent send your password https://bit.ly/claim').tier,'Likely Scam');
 assert.throws(()=>assessMessage('x'.repeat(4097)));assert.throws(()=>normalizeMessage(null));assert.throws(()=>assessMessage('hello',null));
 assert.equal(assessMessage(`urgent click ${'https://bit.ly/1 '.repeat(50)}`).observations.urlCount,config.limits.urls);
});
test('link clues distinguish official suffixes, shorteners and lookalikes without any network access',()=>{
 const check=url=>assessMessage(`urgent verify ${url}`);
 for(const url of ['https://paypa1.com','https://paypol.com','https://paypal.com.attacker.test','https://bit.ly/code','https://account.xyz','https://paypal.com@attacker.test'])assert.equal(check(url).risk,'suspicious',url);
 assert.ok(check('https://paypa1.com').reasons.some(r=>/resembles/.test(r.text)));
 assert.equal(check('https://paypal.com').categories.includes('link'),true);
 assert.ok(check('https://paypal.com').score<check('https://paypa1.com').score);
 assert.equal(check('https://paypal.com').networkAccessed,false);
});
test('saved/trusted thresholds are higher but never whitelist direct code or money requests',()=>{
 const mild='Claim the lottery prize.';
 assert.equal(assessMessage(mild,{senderStatus:'unsaved'}).risk,'unknown');
 assert.equal(assessMessage(mild,{senderStatus:'saved'}).risk,'unknown');
 for(const text of ['Send me money','Send me your OTP','Share your password','Send me 100'])for(const trusted of [false,true])assert.equal(assessMessage(text,{senderStatus:'saved',trusted}).risk,'suspicious',text);
 assert.equal(assessMessage('hello',{senderStatus:'saved',trusted:true,firstTime:true,foreignCountryCode:true}).risk,'unknown');
 assert.equal(assessMessage('hello').context.source,'unavailable');
});
test('ordinary notifications and negated requests do not imply credential demands',()=>{
 for(const text of ['Never share your OTP',"Don't share your password",'Do not send money','Send me lol','Bank: your OTP is 246810. Never share your OTP.','لا تشارك رمز التحقق','Please pay the agreed rent on Friday'])assert.equal(assessMessage(text).risk,'unknown',text);
 assert.equal(assessMessage('Never share your OTP. Urgent send your password to https://bit.ly/code').risk,'suspicious');
});
test('results contain only fixed explanations and aggregate observations, not message bodies, URL tokens or phones',()=>{
 const result=assessMessage('Urgent send your password privatevalue123 https://paypa1.com/private?secret=privatevalue123 +1 202 555 0199');
 assert.doesNotMatch(JSON.stringify(result),/privatevalue123|555|paypa1|secret=/);
 assert.equal(result.secondOpinion.status,'disabled');assert.equal(result.networkAccessed,false);
 const feedback=createMessageFeedback();feedback.report(result.tier,result.categories);assert.throws(()=>feedback.report('privatevalue123'));assert.throws(()=>feedback.report('Safe',['privatevalue123']));assert.doesNotMatch(JSON.stringify(feedback.export()),/privatevalue123|555|paypa1/);assert.equal(Object.keys(feedback.snapshot()).length,3);feedback.clear();assert.equal(feedback.snapshot()['Likely Scam'],0);
});
test('corpus is balanced and includes separate tuning and held comparison cases',async()=>{
 const corpus=JSON.parse(await readFile(new URL('./message-detector-corpus.json',import.meta.url),'utf8'));
 assert.ok(corpus.length>=50);assert.equal(new Set(corpus.map(c=>c.id)).size,corpus.length);
 for(const split of ['tune','holdout'])assert.ok(corpus.filter(c=>c.split===split).length>=20);
 // Regression budget, not a claim of accuracy on real user conversations.
 const falsePositives=corpus.filter(c=>c.label==='legitimate'&&assessMessage(c.text,c.context).risk==='suspicious');
 const falseNegatives=corpus.filter(c=>c.label==='scam'&&assessMessage(c.text,c.context).risk!=='suspicious');
 assert.ok(falsePositives.length<=2,JSON.stringify(falsePositives.map(c=>c.id)));
 // Preserve original corpus labels: these four terse reward claims lack supporting risk.
 assert.deepEqual(falseNegatives.map(c=>c.id).sort(),['h35','t23','t24','t38']);
});
test('new categories retain paired desktop event compatibility without extending its allowlist',async()=>{
 const source=await readFile(new URL('../../demo-runtime/server.mjs',import.meta.url),'utf8');
 const allowed=JSON.parse(source.match(/const allowedCodes=new Set\((\[[^\]]+\])\)/)[1].replaceAll("'",'"'));
 const result=assessMessage('Urgent bank support team send your password to https://bit.ly/claim your prize');
 assert.ok(result.eventCodes.length>0);assert.ok(result.eventCodes.every(c=>allowed.includes(c)));assert.ok(result.reasons.some(r=>r.category==='authority'));
});
function fixture(text){
 const dom=new JSDOM('<!doctype html><body><div class="message-in"><div data-pre-plain-text><span class="selectable-text"></span></div></div></body>');
 const doc=dom.window.document;doc.querySelector('.selectable-text').textContent=text;
 return {dom,doc,node:doc.querySelector('[data-pre-plain-text]')};
}
test('inline warning stays compact with no added settings panel and keeps improved detection',()=>{
 const {dom,doc,node}=fixture('Claim your prize. Send me 10k rupees to activate it.');const control=mountWhatsAppWarnings(doc);
 try{
  const badge=node.querySelector('[data-sentinel-scam]'),shadow=badge.shadowRoot;
  assert.ok(badge.hasAttribute('data-sentinel-flagged'));
  const button=shadow.querySelector('button');button.click();assert.equal(button.getAttribute('aria-expanded'),'true');
  assert.equal(shadow.querySelectorAll('button').length,1);
  assert.equal(shadow.querySelector('details,select,input,ul'),null);
  assert.equal(shadow.querySelectorAll('.detail p').length,2);
  assert.match(shadow.querySelector('.detail').textContent,/Reward bait.*Action demand/);
  button.click();assert.equal(shadow.querySelector('.detail').hidden,true);
  node.querySelector('.selectable-text').textContent='prize';control.refresh();
  assert.equal(node.querySelector('[data-sentinel-scam]'),null);
 }finally{control.stop();dom.window.close();}
});

test('inline direction, recycling and 100-message cap remain enforced without executing message markup',()=>{
 const {dom,doc,node}=fixture('urgent send your password <img src=x onerror=alert(1)>');
 const outgoing=doc.createElement('div');outgoing.className='message-out';outgoing.innerHTML='<div data-pre-plain-text><span class="selectable-text">urgent send your password</span></div>';doc.body.append(outgoing);
 const control=mountWhatsAppWarnings(doc);
 try{assert.equal(outgoing.querySelector('[data-sentinel-scam]'),null);assert.equal(node.querySelector('[data-sentinel-scam]').shadowRoot.querySelector('img'),null);node.className='message-out';node.parentElement.className='message-out';control.refresh();assert.equal(node.querySelector('[data-sentinel-scam]'),null);}finally{control.stop();dom.window.close();}
});
test('observer caps badges to latest 100 and removes them on stop',()=>{
 const {dom,doc,node}=fixture('urgent send your password');
 for(let i=0;i<105;i++)doc.body.append(node.parentElement.cloneNode(true));
 const control=mountWhatsAppWarnings(doc);
 try{assert.equal(doc.querySelectorAll('[data-pre-plain-text] > [data-sentinel-scam]').length,100);assert.equal(node.querySelector('[data-sentinel-scam]'),null);control.stop();assert.equal(doc.querySelectorAll('[data-sentinel-scam]').length,0);}finally{dom.window.close();}
});

test('class reward and pay-to-activate regressions stay distinct without a school whitelist',async()=>{
 const rows=JSON.parse(await readFile(new URL('./message-payment-regressions.json',import.meta.url),'utf8'));
 for(const row of rows)for(const context of [{},{senderStatus:'unsaved'},{senderStatus:'saved',trusted:true}]){
  const result=assessMessage(row.text,context);assert.equal(result.risk==='suspicious',row.label==='scam',row.id);
  if(['money-draw-k','money-draw-dollar','school-not-whitelist'].includes(row.id)){assert.equal(result.tier,'Likely Scam',row.id);assert.ok(result.reasons.some(reason=>reason.code==='advance_fee'));}
 }
});
test('WhatsApp removes class-prize flags and detects payment demands in recycled message bubbles',()=>{
 const {dom,doc,node}=fixture('claim the prize for your excellence in the class today');const control=mountWhatsAppWarnings(doc);
 try{assert.equal(node.querySelector('[data-sentinel-scam]'),null);node.querySelector('.selectable-text').textContent='You have won 1 lakh rupees in the SBI money draw, so send me 10k rupees to activate this.';control.refresh();assert.match(node.querySelector('[data-sentinel-scam]').textContent+node.querySelector('[data-sentinel-scam]').shadowRoot.textContent,/Review message/);node.querySelector('.selectable-text').textContent='come claim the prize papi';control.refresh();assert.equal(node.querySelector('[data-sentinel-scam]'),null);}finally{control.stop();dom.window.close();}
});

test('payment prefixes and negation are handled without requiring links or a brand name',()=>{
 for(const amount of ['$10','10$','₹500','INR500','Rs 500','10k rupees'])assert.equal(assessMessage(`You have won a prize. Send me ${amount} to activate it.`).tier,'Likely Scam',amount);
 for(const text of ['Never send me $10 to activate a prize.','Do not send me INR500 to activate a prize.'])assert.equal(assessMessage(text).risk,'unknown',text);
});
