import test from 'node:test';
import assert from 'node:assert/strict';
import { NavigationHoldRegistry } from '../src/navigation-registry.js';
test('one bounded current hold per tab and fresh IDs on replacement',()=>{
  const r=new NavigationHoldRegistry();
  const old=r.begin(7,100,500);
  const next=r.begin(7,101,500);
  assert.notEqual(old.subject.navigationId,next.subject.navigationId);
  assert.equal(r.size,1);
  assert.equal(r.finish(old.subject,'potentially_harmful',102),null);
  assert.equal(r.continueOnce(old,102),null);
  assert.equal(r.read(7),next);
});
test('admission bounded at 32 without evicting active hold; clear releases slot',()=>{
  const r=new NavigationHoldRegistry();
  for(let i=0;i<32;i++) r.begin(i,100,500);
  assert.equal(r.begin(33,100,500),null);
  assert.equal(r.size,32);
  assert.equal(r.read(0).state,'held');
  assert.equal(r.clear(0),true);
  assert.equal(r.clear(0),false);
  assert.equal(r.begin(33,101,500).state,'held');
});
test('clearing or replacing invalidates old handle across registry operations',()=>{
  const r=new NavigationHoldRegistry();
  const h=r.begin(1,100,500);
  r.clear(1);
  assert.equal(r.continueOnce(h,101),null);
  assert.equal(r.finish(h.subject,'unknown',101),null);
  const fresh=r.begin(1,102,500);
  assert.notEqual(fresh.subject.assessmentId,h.subject.assessmentId);
  const foreign=new NavigationHoldRegistry().begin(1,102,500);
  assert.equal(r.continueOnce(foreign,103),null);
});
test('returned current snapshot governs replay, expiry and terminal state',()=>{
  const r=new NavigationHoldRegistry();
  const h=r.begin(1,100,500);
  const inspected=r.finish(h.subject,'potentially_harmful',110);
  assert.equal(r.continueOnce(h,111),null);
  assert.equal(r.continueOnce(inspected,111).state,'continued_once');
  assert.equal(r.continueOnce(inspected,112),null);
  assert.equal(r.finish(h.subject,'unknown',113).reason,'potentially_harmful');
  r.begin(2,100,10);
  assert.equal(r.finish(r.read(2).subject,'unknown',110).state,'expired');
});
test('invalid replacement preserves current hold and extra inputs never echo',()=>{
  const r=new NavigationHoldRegistry();
  const h=r.begin(1,100,500);
  assert.throws(()=>r.begin(1,NaN,500));
  assert.equal(r.read(1),h);
  assert.equal(r.finish({...h.subject,tabId:2,url:'private'},'unknown',101),null);
  assert.equal(r.read(1),h);
});

test('timer expires idle warnings once without extending their deadline',()=>{
  const r=new NavigationHoldRegistry();
  const h=r.begin(1,100,50);
  assert.deepEqual(r.expire(149),[]);
  assert.equal(r.read(1),h);
  const expired=r.expire(150);
  assert.equal(expired.length,1);
  assert.equal(expired[0].state,'expired');
  assert.equal(expired[0].reason,'inspection_required');
  assert.equal(r.read(1),expired[0]);
  assert.deepEqual(r.expire(151),[]);
  assert.equal(r.continueOnce(h,151),null);
  assert.equal(r.continueOnce(expired[0],151),null);
  assert.equal(r.finish(h.subject,'potentially_harmful',151),expired[0]);
});

test('polling leaves an on-time inspection unsealed and retains its result on expiry',()=>{
  const r=new NavigationHoldRegistry();
  const h=r.begin(1,100,50);
  assert.deepEqual(r.expire(110),[]);
  const inspected=r.finish(h.subject,'potentially_harmful',111);
  assert.equal(inspected.reason,'potentially_harmful');
  assert.deepEqual(r.expire(149),[]);
  const [expired]=r.expire(150);
  assert.equal(expired.reason,'potentially_harmful');
  assert.equal(r.continueOnce(inspected,150),null);
});

test('timer excludes cleared, replaced and continued holds and bounds each batch',()=>{
  const r=new NavigationHoldRegistry();
  for(let i=0;i<32;i++)r.begin(i,100,50);
  r.clear(0);
  const replacement=r.begin(1,101,100);
  r.continueOnce(r.read(2),110);
  const expired=r.expire(150);
  assert.equal(expired.length,29);
  assert.equal(r.read(1),replacement);
  assert.equal(r.read(2).state,'continued_once');
  assert.equal(new Set(expired.map(h=>h.subject.tabId)).size,29);
  assert.deepEqual(r.expire(151),[]);
  assert.equal(r.expire(201).length,1);
});

test('invalid timer inputs preserve every hold; rollback expires held authority',()=>{
  const r=new NavigationHoldRegistry();
  const h=r.begin(1,100,50);
  for(const now of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>r.expire(now),/invalid navigation clock/);
    assert.equal(r.read(1),h);
  }
  assert.equal(r.expire(99)[0].state,'expired');
  assert.equal(r.continueOnce(h,100),null);
});
