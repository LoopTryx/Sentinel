import test from 'node:test';
import assert from 'node:assert/strict';
import {messageFingerprint,alertHistory,rememberAlert,resetAlerts} from '../src/message-alert-history.js';
test('confirmed fingerprints persist across readers, isolate sites and reset without reviving stale decisions',async()=>{
 const data={};const api={storage:{local:{get:async key=>({[key]:data[key]}),set:async value=>Object.assign(data,value)}}};
 const hash=await messageFingerprint('whatsapp','A suspicious message');
 assert.match(hash,/^[a-f0-9]{64}$/);
 assert.notEqual(hash,await messageFingerprint('gmail','A suspicious message'));
 const first=await alertHistory(api,'whatsapp');
 await Promise.all([rememberAlert(api,'whatsapp',hash,first.epoch),rememberAlert(api,'whatsapp',hash,first.epoch)]);
 assert.deepEqual((await alertHistory(api,'whatsapp')).hashes,[hash]);
 assert.deepEqual((await alertHistory(api,'gmail')).hashes,[]);
 assert.ok(!JSON.stringify(data).includes('A suspicious message'));
 await resetAlerts(api,'whatsapp');
 await rememberAlert(api,'whatsapp',hash,first.epoch);
 assert.deepEqual((await alertHistory(api,'whatsapp')).hashes,[]);
 const next=await alertHistory(api,'whatsapp');await rememberAlert(api,'whatsapp',hash,next.epoch);
 assert.deepEqual((await alertHistory(api,'whatsapp')).hashes,[hash]);
});
