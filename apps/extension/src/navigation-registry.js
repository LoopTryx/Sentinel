import {createNavigationHold, finishInspection, consumeContinuation, invalidateHold} from './navigation-hold.js';

// Internal trusted extension owner, not a content-script request endpoint.
export class NavigationHoldRegistry {
  #tabs = new Map();
  #sequence = 0;
  get size() { return this.#tabs.size; }
  begin(tabId, now, ttlMs) {
    if (!Number.isSafeInteger(tabId) || tabId < 0) throw new TypeError('invalid navigation hold');
    if (!this.#tabs.has(tabId) && this.#tabs.size >= 32) return null;
    if (this.#sequence === Number.MAX_SAFE_INTEGER) return null;
    const id = this.#sequence + 1;
    // Validate before invalidating the current session or allocating its ID.
    const next = createNavigationHold({tabId,navigationId:`nav-${id}`,assessmentId:`assessment-${id}`},now,ttlMs);
    const old = this.#tabs.get(tabId);
    if (old) invalidateHold(old);
    this.#sequence = id;
    this.#tabs.set(tabId,next);
    return next;
  }
  read(tabId) { return this.#tabs.get(tabId) ?? null; }
  finish(subject, reason, now) {
    const hold = this.#tabs.get(subject?.tabId);
    if (!hold || hold.subject.navigationId !== subject.navigationId || hold.subject.assessmentId !== subject.assessmentId) return null;
    const next = finishInspection(hold,subject,reason,now);
    this.#tabs.set(hold.subject.tabId,next);
    return next;
  }
  continueOnce(snapshot, now) {
    if (!snapshot || this.#tabs.get(snapshot.subject?.tabId) !== snapshot) return null;
    const next = consumeContinuation(snapshot,snapshot.subject,now);
    // Synchronize an expired snapshot even when continuation is rejected.
    this.#tabs.set(snapshot.subject.tabId,next ?? finishInspection(snapshot,snapshot.subject,'unknown',now));
    return next;
  }
  clear(tabId) {
    const hold = this.#tabs.get(tabId);
    if (!hold) return false;
    invalidateHold(hold);
    this.#tabs.delete(tabId);
    return true;
  }
}
