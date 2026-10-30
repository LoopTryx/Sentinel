import assert from 'node:assert/strict';
import {test} from 'node:test';
import {explainUrl, explainMessage} from '../src/local-checks.js';
test('owner HTTP example preserves all structural warnings',()=>{
 const result=explainUrl('http://school-login.example.com@192.0.2.10:8080/verify');
 assert.equal(result.scheme,'http'); assert.equal(result.host,'192.0.2.10');
 assert.deepEqual(result.reasons.map(r=>r.code),['credentials','http','ip','port']);
});
test('shortened HTTPS destinations warn without fetching or suffix confusion',()=>{
 for(const host of ['bit.ly','tinyurl.com','t.co','is.gd','bit.ly.']) {
  const result=explainUrl(`https://${host}/invented-private-code?token=secret`);
  assert.ok(result.reasons.some(r=>r.code==='shortened'));
  assert.equal(result.networkAccessed,false); assert.equal(result.reputationChecked,false);
  assert.doesNotMatch(JSON.stringify(result),/invented-private-code|token|secret/);
 }
 assert.equal(explainUrl('https://bit.ly.example.test/login').risk,'unknown');
});
test('reward plus payment bait is a clue while ordinary login and query words stay unknown',()=>{
 for(const path of ['/claim-prize/pay-fee','/%63laim-prize/%70ay-fee']) {
  const result=explainUrl(`https://example.test${path}?private=secret`);
  assert.ok(result.reasons.some(r=>r.code==='reward_payment'));
  assert.doesNotMatch(JSON.stringify(result),/claim-prize|pay-fee|private|secret/);
 }
 assert.equal(explainUrl('https://example.test/login').risk,'unknown');
 assert.equal(explainUrl('https://example.test/?q=claim-prize-pay-fee').risk,'unknown');
 assert.equal(explainUrl('https://example.test/prize').risk,'unknown');
});
test('URL explanation identifies actual destination without leaking private URL components',()=>{
 const result=explainUrl('https://trusted.test:invented@evil.test:8443/private?token=invented#secret');
 assert.equal(result.host,'evil.test'); assert.equal(result.coverage,'partial');
 assert.ok(result.reasons.some(reason=>reason.code==='credentials'));
 assert.doesNotMatch(JSON.stringify(result),/invented|private|secret|token|trusted/);
});
test('no local flags remain unknown and input bounds reject ambiguous URLs',()=>{
 assert.equal(explainUrl('https://example.test').risk,'unknown');
 for(const input of ['javascript:alert(1)',' https://example.test','https://exa\\mple.test','https://example.test/\u202e','x'.repeat(2049)]) assert.throws(()=>explainUrl(input));
 assert.ok(explainUrl('http://127.0.0.1').reasons.some(r=>r.code==='http'));
 assert.match(explainUrl('https://bücher.test').host,/^xn--/);
});
test('message checks are bounded local clues, not clean or malicious verdicts',()=>{
 assert.equal(explainMessage('hello').risk,'unknown');
 const result=explainMessage('URGENT send money verify your account');
 assert.equal(result.risk,'suspicious'); assert.ok(result.reasons.length>1);
 assert.doesNotMatch(JSON.stringify(result),/URGENT send money/);
 assert.throws(()=>explainMessage('x'.repeat(4097)));
});
test('bare cash claims and price typos need supporting risk evidence',()=>{
 for(const message of ['Come claim your price of 100$!!','Come claim your free price of 100$!!','Claim your cash of $100','CLAIM YOUR MONEY £200']){
  const result=explainMessage(message);
  assert.equal(result.risk,'unknown');
  assert.ok(result.signals.some(r=>r.code==='reward'));
  assert.equal(result.networkAccessed,false);
 }
 for(const message of ['The price is 100$','Please confirm the price of $100','I bought this for $100','Claim your receipt for $100','The prizewinning project has a price tag'])assert.equal(explainMessage(message).risk,'unknown');
});
