import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handoffInput,sendAiHandoff,pendingAiHandoff} from '../src/ai-handoff.js';
import {makeNavigationRules} from '../src/navigation-policy.js';
test('handoff strips credential/query/fragment and does not send without an explicit call',()=>{
 const input=handoffInput('https://user:secret@example.test/path?token=secret#secret','Why?');
 assert.equal(input.url,'https://example.test/path');assert.match(input.nonce,/^[a-f0-9]{32}$/);
 assert.throws(()=>handoffInput('file:///private','?'));
});
test('unavailable desktop preserves a bounded expiring question and success clears it',async()=>{
 let saved={};let available=false;
 const api={storage:{session:{set:async r=>Object.assign(saved,r),get:async()=>saved,remove:async k=>delete saved[k]}},runtime:{sendMessage:async()=>available?{data:{handoffId:'id'}}:{error:'offline'}}};
 const input=handoffInput('https://example.test/','Why?');
 await assert.rejects(sendAiHandoff(input,api),/unavailable/);assert.deepEqual(await pendingAiHandoff(api),input);
 available=true;await sendAiHandoff(input,api);assert.equal(await pendingAiHandoff(api),null);
});
test('production redirects retain whole URL for local reassessment without changing match decisions',()=>{
 const rules=makeNavigationRules({hosts:['bad.test']},'chrome-extension://'+'a'.repeat(32)+'/warning.html');
 for(const r of rules)assert.match(r.action.redirect.regexSubstitution,/#url=\\0$/);
 const input='https://example.test/winner-payment?test=1';
 assert.equal(input.replace(new RegExp(rules[1].condition.regexFilter,'i'),rules[1].action.redirect.regexSubstitution.replace('\\0',()=>'$&')).split('#url=')[1],input);
});

