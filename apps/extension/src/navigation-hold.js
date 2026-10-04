// Native extension lifecycle only: no DNR registration, fetching or UI authority.
// WeakMap retains no history once host releases snapshots; host must bound tabs.
const owners = new WeakMap();
const reference = /^[A-Za-z0-9_-]{1,64}$/;
const reasons = new Set(['unknown', 'potentially_harmful']);
function same(a, b) {
  return b && a.tabId === b.tabId && a.navigationId === b.navigationId && a.assessmentId === b.assessmentId;
}
function publish(owner, state, reason) {
  const snapshot = Object.freeze({ subject: owner.subject, state, reason, coverage: 'partial' });
  owner.current = snapshot;
  owners.set(snapshot, owner);
  return snapshot;
}
export function createNavigationHold(subject, now, ttlMs) {
  if (!subject || !Number.isSafeInteger(subject.tabId) || subject.tabId < 0 ||
      typeof subject.navigationId !== 'string' || !reference.test(subject.navigationId) ||
      typeof subject.assessmentId !== 'string' || !reference.test(subject.assessmentId) ||
      !Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 300000 ||
      !Number.isSafeInteger(now + ttlMs)) throw new TypeError('invalid navigation hold');
  // Copy only fixed correlation fields, never URL, content or caller properties.
  const owner = {subject:Object.freeze({tabId:subject.tabId,navigationId:subject.navigationId,assessmentId:subject.assessmentId}), last:now, expires:now+ttlMs};
  return publish(owner, 'held', 'inspection_required');
}
function current(hold, subject, now) {
  const owner = owners.get(hold);
  if (!owner || owner.current !== hold || hold.state !== 'held' || !same(owner.subject, subject)) return null;
  if (!Number.isSafeInteger(now) || now < owner.last || now >= owner.expires) {
    publish(owner, 'expired', hold.reason);
    return null;
  }
  owner.last = now;
  return owner;
}
export function finishInspection(hold, subject, reason, now) {
  if (!reasons.has(reason)) throw new TypeError('invalid navigation reason');
  const owner = current(hold, subject, now);
  if (!owner) return owners.get(hold)?.current ?? hold;
  if (owner.inspected) return hold;
  owner.inspected = true;
  // Even ordinary results stay held/unknown until an explicit user decision.
  return publish(owner, 'held', reason);
}
export function consumeContinuation(hold, subject, now) {
  const owner = current(hold, subject, now);
  return owner ? publish(owner, 'continued_once', hold.reason) : null;
}
export function invalidateHold(hold) {
  const owner = owners.get(hold);
  if (!owner || owner.current !== hold || hold.state !== 'held') return owner?.current ?? hold;
  return publish(owner, 'invalidated', hold.reason);
}
