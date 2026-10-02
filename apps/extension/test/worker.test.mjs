// Regression tests that execute the real service-worker module under a mocked
// Chrome API surface. Each test loads a fresh module instance (query-string
// cache buster), captures the registered onMessage listener, and asserts
// request/response behaviour that source-string checks cannot prove:
// exactly-once answers, diagnostic storage failures, foreign senders,
// invalid toggle input, update rejection vs. actual state, toggle ordering,
// and restart recompute. All waits are bounded so a missing response fails
// the test instead of hanging it.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const EXTENSION_ID = 'sentinel-harness-test-id';
const RESPONSE_TIMEOUT_MS = 1000;

let instanceCounter = 0;

function createChromeMock({
  enabledRulesets = ['fixture_block'],
  updateRejectsFirst = 0,
  storageError = null,
  rulesetQueryError = null,
  manifestError = null,
} = {}) {
  let current = [...enabledRulesets];
  const calls = { queries: 0, updates: [], storageSets: [] };
  const chrome = {
    runtime: {
      id: EXTENSION_ID,
      getManifest: () => {
        if (manifestError) {
          throw manifestError;
        }
        return { permissions: ['declarativeNetRequest', 'storage'] };
      },
      onMessage: {
        addListener(fn) {
          chrome.__listener = fn;
        },
      },
      onInstalled: {
        addListener(fn) {
          chrome.__onInstalled = fn;
        },
      },
    },
    declarativeNetRequest: {
      async getEnabledRulesets() {
        calls.queries += 1;
        if (rulesetQueryError) {
          throw rulesetQueryError;
        }
        return [...current];
      },
      async updateEnabledRulesets(update) {
        calls.updates.push(update);
        if (updateRejectsFirst > 0) {
          updateRejectsFirst -= 1;
          throw new Error('mocked update rejection');
        }
        if (update.enableRulesetIds) {
          current = ['fixture_block'];
        }
        if (update.disableRulesetIds) {
          current = [];
        }
      },
    },
    storage: {
      local: {
        async set(items) {
          calls.storageSets.push(items);
          if (storageError) {
            throw storageError;
          }
        },
      },
    },
    __listener: null,
  };
  return { chrome, calls };
}

async function loadWorker(mockOptions = {}) {
  const { chrome, calls } = createChromeMock(mockOptions);
  globalThis.chrome = chrome;
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    instanceCounter += 1;
    const module = await import(`../src/service-worker.js?instance=${instanceCounter}`);
    await sleep(20); // let the top-level startup status settle
    assert.equal(unhandled.length, 0, `worker start produced unhandled rejections: ${format(unhandled)}`);
    assert.ok(chrome.__listener, 'worker did not register an onMessage listener');
    return { module, chrome, calls, listener: chrome.__listener, unhandled };
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}

function format(errors) {
  return errors.map((error) => String(error?.message ?? error)).join('; ');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, what) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > RESPONSE_TIMEOUT_MS) {
      throw new Error(`timed out waiting for ${what} — the request was never answered`);
    }
    await sleep(5);
  }
}

// Dispatches through the captured listener exactly like chrome.runtime does.
async function request(listener, message, sender = { id: EXTENSION_ID }) {
  const responses = [];
  const sendResponse = (response) => responses.push(response);
  const willAnswer = listener(message, sender, sendResponse);
  if (!willAnswer) {
    return { answered: false, responses };
  }
  await waitFor(() => responses.length > 0, `a response to ${message.kind}`);
  return { answered: true, responses };
}

test('status request is answered exactly once with runtime-derived state', async () => {
  const { calls, listener } = await loadWorker();
  const { answered, responses } = await request(listener, { kind: 'harness_status' });
  assert.equal(answered, true);
  assert.equal(responses.length, 1);
  assert.equal(responses[0].kind, 'harness_status');
  assert.equal(responses[0].status.fixtureRule.state, 'active');
  assert.equal(responses[0].status.coverage, 'fixture_only');
  assert.ok(calls.queries >= 2, 'expected a fresh ruleset query for the request, not only startup');
});

test('diagnostic storage rejection still answers exactly once with valid status', async () => {
  const { calls, listener } = await loadWorker({ storageError: new Error('mocked storage failure') });
  const { responses } = await request(listener, { kind: 'harness_status' });
  assert.equal(responses.length, 1);
  assert.equal(responses[0].status.fixtureRule.state, 'active');
  assert.ok(calls.storageSets.length >= 2, 'worker should still attempt diagnostic writes');
});

test('foreign sender is neither answered nor allowed to mutate', async () => {
  const { calls, listener } = await loadWorker();
  const { answered, responses } = await request(
    listener,
    { kind: 'harness_toggle_fixture', enabled: false },
    { id: 'some-other-extension' }
  );
  assert.equal(answered, false);
  assert.deepEqual(responses, []);
  assert.deepEqual(calls.updates, []);
});

test('invalid toggle input is rejected without mutation', async () => {
  const { calls, listener } = await loadWorker();
  const cases = [{ enabled: 'yes' }, { enabled: 1 }, {}, null];
  for (const badInput of cases) {
    const { answered, responses } = await request(listener, {
      kind: 'harness_toggle_fixture',
      ...(badInput ?? {}),
    });
    assert.equal(answered, false);
    assert.deepEqual(responses, []);
  }
  assert.deepEqual(calls.updates, []);
});

test('rejected update followed by a successful query reports the actual unchanged state', async () => {
  const { calls, listener } = await loadWorker({ updateRejectsFirst: 1 });
  const { responses } = await request(listener, { kind: 'harness_toggle_fixture', enabled: false });
  assert.equal(responses.length, 1);
  // The disable update was rejected, so the ruleset is still enabled: the
  // fresh query is the authority and must say active, not unknown.
  assert.equal(responses[0].status.fixtureRule.state, 'active');
  assert.equal(calls.updates.length, 1);
});

test('queued enable/disable run in order and the queue survives a failure', async () => {
  const { calls, listener } = await loadWorker({ updateRejectsFirst: 1 });
  const first = request(listener, { kind: 'harness_toggle_fixture', enabled: true });
  const second = request(listener, { kind: 'harness_toggle_fixture', enabled: false });
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.deepEqual(
    calls.updates.map((update) => (update.enableRulesetIds ? 'enable' : 'disable')),
    ['enable', 'disable']
  );
  // First (rejected) toggle reports the unchanged actual state; second
  // toggle succeeds and the fresh query reflects it.
  assert.equal(firstResult.responses[0].status.fixtureRule.state, 'active');
  assert.equal(secondResult.responses[0].status.fixtureRule.state, 'disabled');
});

test('a fresh worker instance re-queries Chrome instead of trusting stored status', async () => {
  globalThis.chrome = undefined;
  // First instance: rule active, snapshot written by the worker itself.
  await loadWorker();
  // Second instance: fresh start with a bogus "previously stored" snapshot
  // claiming disabled, while the real query says active.
  const staleStorage = {
    set(items) {
      this.lastWrite = items;
      return Promise.resolve();
    },
    lastWrite: null,
    pretendStoredSnapshot: { fixtureRule: { state: 'disabled' } },
  };
  const { chrome, calls, listener } = await loadWorker();
  chrome.storage.local = staleStorage;
  const { responses } = await request(listener, { kind: 'harness_status' });
  assert.equal(responses.length, 1);
  assert.equal(responses[0].status.fixtureRule.state, 'active');
  assert.ok(calls.queries >= 2, 'fresh worker must query Chrome at startup and on request');
});

test('startup with rejecting storage produces no unhandled rejection', async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    await loadWorker({ storageError: new Error('mocked storage failure') });
    await sleep(20);
    assert.equal(unhandled.length, 0, `unhandled rejections: ${format(unhandled)}`);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('captured onInstalled listener performs install writes and status recompute', async () => {
  const { chrome, calls } = await loadWorker();
  const before = { queries: calls.queries, sets: calls.storageSets.length };
  assert.ok(chrome.__onInstalled, 'worker did not register an onInstalled listener');
  chrome.__onInstalled();
  await waitFor(
    () => calls.storageSets.length > before.sets && calls.queries > before.queries,
    'install-time diagnostics and status recompute'
  );
  const newWrites = calls.storageSets.slice(before.sets);
  assert.ok(
    newWrites.some((write) => write.harnessInstalledAt),
    'install timestamp not recorded'
  );
  assert.ok(
    newWrites.some((write) => write.harnessStatus),
    'status snapshot not refreshed on install'
  );
});

test('ruleset query rejection answers once with an unknown rule state', async () => {
  const { listener } = await loadWorker({ rulesetQueryError: new Error('mocked query failure') });
  const { responses } = await request(listener, { kind: 'harness_status' });
  assert.equal(responses.length, 1);
  assert.equal(responses[0].status.fixtureRule.state, 'unknown');
  assert.equal(responses[0].status.agent.state, 'unconfigured');
});

test('unexpected status computation failure answers exactly once with null status', async () => {
  const { listener } = await loadWorker({ manifestError: new Error('mocked manifest failure') });
  const { responses } = await request(listener, { kind: 'harness_status' });
  assert.equal(responses.length, 1);
  assert.equal(responses[0].status, null, 'the rejection fallback must deliver a null status, not hang');
});
