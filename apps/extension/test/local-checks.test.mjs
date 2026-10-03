import assert from 'node:assert/strict';
import {test} from 'node:test';
import {explainUrl, explainMessage} from '../src/local-checks.js';
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
