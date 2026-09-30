import { FIXTURE_RULESET_ID, computeStatus } from './status.js';

const STATUS_KEY = 'harnessStatus';

async function currentStatus() {
  let enabledRulesetIds = null;
  try {
    enabledRulesetIds = await chrome.declarativeNetRequest.getEnabledRulesets();
  } catch (error) {
    console.warn('Sentinel harness: ruleset query failed', error);
  }
  const manifestPermissions = chrome.runtime.getManifest().permissions ?? [];
  const status = computeStatus({
    enabledRulesetIds,
    manifestPermissions,
    checkedAt: new Date().toISOString(),
  });
  await chrome.storage.local.set({ [STATUS_KEY]: status });
  return status;
}

async function setFixtureRuleEnabled(enabled) {
  const update = enabled
    ? { enableRulesetIds: [FIXTURE_RULESET_ID] }
    : { disableRulesetIds: [FIXTURE_RULESET_ID] };
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets(update);
  } catch (error) {
    console.warn('Sentinel harness: ruleset update failed', error);
  }
  return currentStatus();
}

// Toggles are serialized so overlapping popup updates cannot interleave the
// ruleset mutation; every run still re-reads the final ruleset state.
let ruleUpdateChain = Promise.resolve();
function queueFixtureRuleUpdate(enabled) {
  const run = ruleUpdateChain.then(() => setFixtureRuleEnabled(enabled));
  ruleUpdateChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

// Recompute on every service-worker cold start so the stored snapshot can
// never outlive the browser's actual ruleset state.
currentStatus();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ harnessInstalledAt: new Date().toISOString() });
  currentStatus();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    return false;
  }
  if (message?.kind === 'harness_status') {
    currentStatus().then((status) => sendResponse({ kind: 'harness_status', status }));
    return true;
  }
  if (message?.kind === 'harness_toggle_fixture' && typeof message.enabled === 'boolean') {
    queueFixtureRuleUpdate(message.enabled).then((status) => sendResponse({ kind: 'harness_status', status }));
    return true;
  }
  return false;
});
