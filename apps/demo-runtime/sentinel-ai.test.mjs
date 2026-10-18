import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAiHandoff} from './sentinel-ai.mjs';
test('runtime computes findings and consumes bounded authenticated handoffs once',()=>{
 let now=1000;const ai=createAiHandoff(()=>now);
 const result=ai.create({url:'https://example.test/winner-payment',question:'Why?',nonce:'a'.repeat(32)});
 assert.equal(result.finding.source,'local_url_assessment');
 assert.ok(result.finding.signals.some(s=>s.code==='reward_payment'));
 assert.throws(()=>ai.create({url:'https://example.test/',question:'Why?',nonce:'a'.repeat(32)}),/replayed/);
 assert.equal(ai.take().finding.ref,result.finding.ref);assert.equal(ai.take(),null);
 assert.equal(ai.resolve(result.finding.ref).ref,result.finding.ref);
 now+=300001;assert.throws(()=>ai.resolve(result.finding.ref),/expired/);
});
test('finding claims and secrets in URL are not accepted as evidence',()=>{
 const ai=createAiHandoff();
 assert.throws(()=>ai.create({url:'https://example.test/',question:'?',nonce:'b'.repeat(32),blocked:true}),/invalid/);
 const r=ai.create({url:'https://user:secret@example.test/winner-payment?token=secret#secret',question:'?',nonce:'c'.repeat(32)});
 assert.ok(!JSON.stringify(r).includes('secret'));assert.equal(r.finding.url,'https://example.test/winner-payment');
});

test('message handoffs recompute evidence, redact secrets and retain the source',()=>{
 const ai=createAiHandoff();
 const r=ai.createMessage({source:'whatsapp',text:'Urgent! Your account will be closed. Send your password and OTP 123456 now. https://bit.ly/claim',nonce:'d'.repeat(32)});
 assert.equal(r.finding.source,'whatsapp_message');assert.ok(r.finding.signals.some(s=>s.code==='message_excerpt'));
 assert.ok(!JSON.stringify(r).includes('123456'));assert.ok(r.finding.signals.some(s=>s.code==='credentials'));
 assert.equal(ai.take(),null);ai.publishQuick(r.finding.ref,{provider:'On device',kind:'local_interpretation',text:'Payment request',verdict:'likely'});assert.equal(ai.take().finding.ref,r.finding.ref);
 assert.throws(()=>ai.createMessage({source:'arbitrary',text:'hello',nonce:'e'.repeat(32)}),/invalid/);
 assert.throws(()=>ai.createMessage({source:'whatsapp',text:'hello',nonce:'d'.repeat(32)}),/replayed/);
});

test('message context is bounded/redacted, preserved in trusted finding and not announced for uncertain advice',()=>{const ai=createAiHandoff();const row=ai.createMessage({source:'gmail',text:'Never share your code',history:['Earlier discussion','password=secret 123456'],nonce:'f'.repeat(32)});const context=row.finding.signals.find(s=>s.code==='message_context').text;assert.ok(context.includes('Earlier discussion'));assert.ok(!context.includes('secret'));assert.ok(!context.includes('123456'));ai.publishQuick(row.finding.ref,{provider:'On device',kind:'local_interpretation',text:'Uncertain',verdict:'uncertain'});assert.equal(ai.take(),null);assert.throws(()=>ai.createMessage({source:'gmail',text:'hi',history:['x'.repeat(3001)],nonce:'e'.repeat(32)}));});
