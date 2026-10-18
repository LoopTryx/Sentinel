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
