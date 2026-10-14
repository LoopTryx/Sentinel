import {test} from 'node:test';import assert from 'node:assert/strict';
import {assessEmail} from '../src/email/scoring.js';import {createSenderStore} from '../src/email/sender-store.js';
const email=body=>({body,subject:null});
test('email engine never flags one keyword, sender metadata alone, or ordinary code notifications',()=>{
 for(const body of ['prize','urgent','password','beneficiary','invoice','Your OTP is 246810. Never share your OTP.'])assert.equal(assessEmail(email(body),{firstTime:true}).tier,'Safe',body);
});
test('email scoring reuses multilingual chat signals and explains combinations without raw content',()=>{
 const r=assessEmail(email('Urgent claim your lottery prize immediately privateTokenABC'),{firstTime:true});assert.notEqual(r.tier,'Safe');assert.ok(r.reasons.length>=2);assert.doesNotMatch(JSON.stringify(r),/privateTokenABC/);
 assert.notEqual(assessEmail(email('عاجل أرسل رمز التحقق'),{firstTime:true}).tier,'Safe');
});
test('known/trusted senders retain warnings for direct requests and changed bank details',()=>{
 for(const body of ['Send me your password','Send me money','Please use updated bank details for this payment'])assert.notEqual(assessEmail(email(body),{known:true,trusted:true}).tier,'Safe',body);
});
test('unverified repeated observations never silently grant trust; sender store contains addresses only',async()=>{
 let stored={};const api={storage:{local:{setAccessLevel:async()=>{},get:async()=>stored,set:async value=>{stored=structuredClone(value);}}}};
 const store=createSenderStore(api);assert.equal((await store.context('sender@example.test')).firstTime,true);const again=await store.context('sender@example.test');assert.equal(again.firstTime,false);assert.equal(again.known,false);
 await store.trust('sender@example.test');assert.equal((await store.context('sender@example.test')).trusted,true);await store.untrust('sender@example.test');assert.equal((await store.context('sender@example.test')).trusted,false);
 assert.deepEqual(Object.keys(stored.emailSenderHistoryV1).sort(),['seen','trusted']);await store.clear();assert.deepEqual(stored.emailSenderHistoryV1,{seen:[],trusted:[]});
});
test('sender storage refuses malformed addresses and unavailable private storage rather than storing broadly',async()=>{
 const store=createSenderStore({storage:{local:{get:async()=>({})}}});assert.throws(()=>store.context('not an address'));await assert.rejects(store.context('sender@example.test'),/unavailable/);
});
