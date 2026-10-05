import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationHold, finishInspection, consumeContinuation, invalidateHold } from '../src/navigation-hold.js';

const subject = { tabId: 7, navigationId: 'nav-1', assessmentId: 'assessment-1' };
test('held navigation keeps unknown coverage and fixed path-free output', () => {
  const hold = createNavigationHold(subject, 100, 500);
  assert.equal(hold.state, 'held');
  assert.equal(hold.coverage, 'partial');
  assert.equal(hold.reason, 'inspection_required');
  assert.equal(JSON.stringify(hold).includes('http'), false);
  assert.equal(finishInspection(hold, subject, 'potentially_harmful', 110).reason, 'potentially_harmful');
});
test('inspection completion is sealed against replay and caller fields are excluded', () => {
  const hold = createNavigationHold({...subject,url:'https://private.invalid',body:'private'},100,500);
  const inspected = finishInspection(hold,subject,'potentially_harmful',110);
  assert.equal(finishInspection(inspected,subject,'unknown',111),inspected);
  assert.equal(JSON.stringify(hold).includes('private'),false);
  assert.equal(consumeContinuation(hold,subject,112),null);
  assert.equal(consumeContinuation(inspected,subject,112).state,'continued_once');
});
test('stale and wrong-tab results cannot replace held subject', () => {
  const hold = createNavigationHold(subject, 100, 500);
  for (const wrong of [{...subject, tabId:8}, {...subject,navigationId:'nav-2'}, {...subject,assessmentId:'assessment-2'}]) {
    assert.equal(finishInspection(hold, wrong, 'potentially_harmful', 110), hold);
    assert.equal(consumeContinuation(hold, wrong, 110), null);
  }
});
test('continuation is explicit single use and terminal output is sealed', () => {
  const hold = createNavigationHold(subject, 100, 500);
  const next = consumeContinuation(hold, subject, 110);
  assert.equal(next.state, 'continued_once');
  assert.equal(consumeContinuation(hold, subject, 111), null);
  assert.equal(consumeContinuation(JSON.parse(JSON.stringify(hold)), subject, 111), null);
  assert.equal(consumeContinuation(next, subject, 111), null);
  assert.equal(finishInspection(next, subject, 'potentially_harmful', 112), next);
  const closed = invalidateHold(createNavigationHold(subject,100,500));
  assert.equal(closed.state, 'invalidated');
  assert.equal(consumeContinuation(closed, subject, 111), null);
  assert.equal(finishInspection(closed, subject, 'potentially_harmful', 112), closed);
});
test('expiry and clock regression fail closed; bounds reject invalid inputs', () => {
  const hold = createNavigationHold(subject, 100, 500);
  assert.equal(consumeContinuation(hold, subject, 600), null);
  assert.equal(consumeContinuation(hold, subject, 99), null);
  assert.equal(finishInspection(hold,subject,'unknown',600).state,'expired');
  assert.throws(()=>createNavigationHold({...subject,tabId:-1},100,500));
  assert.throws(()=>createNavigationHold({...subject,navigationId:'x'.repeat(65)},100,500));
  assert.throws(()=>createNavigationHold(subject,100,300001));
  assert.throws(()=>createNavigationHold(subject,NaN,500));
  assert.throws(()=>finishInspection(hold,subject,'safe',110));
});
