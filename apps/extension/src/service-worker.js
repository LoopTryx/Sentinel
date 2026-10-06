import { FIXTURE_RULESET_ID, computeStatus } from './status.js';
import {demoRequest} from './demo-transport.js';

const STATUS_KEY = 'harnessStatus';

function warn(scope, error) {
  console.warn(`Sentinel harness: ${scope}`, error);
}

async function currentStatus() {
  let enabledRulesetIds = null;
  try {
    enabledRulesetIds = await chrome.declarativeNetRequest.getEnabledRulesets();
  } catch (error) {
    warn('ruleset query failed', error);
  }
  const manifestPermissions = chrome.runtime.getManifest().permissions ?? [];
  const status = computeStatus({
    enabledRulesetIds,
    manifestPermissions,
    checkedAt: new Date().toISOString(),
  });
  // Diagnostic persistence is best-effort: a storage failure must never
  // prevent the caller from receiving the otherwise valid status.
  try {
    await chrome.storage.local.set({ [STATUS_KEY]: status });
  } catch (error) {
    warn('diagnostic write failed', error);
  }
  return status;
}

async function setFixtureRuleEnabled(enabled) {
  const update = enabled
    ? { enableRulesetIds: [FIXTURE_RULESET_ID] }
    : { disableRulesetIds: [FIXTURE_RULESET_ID] };
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets(update);
  } catch (error) {
    warn('ruleset update failed', error);
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

// Every accepted request answers exactly once, even on an unexpected
// rejection; the popup renders a null status as "unavailable" rather than
// waiting forever.
function respondWithStatus(pending, sendResponse) {
  let settled = false;
  const settle = (response) => {
    if (!settled) {
      settled = true;
      sendResponse(response);
    }
  };
  pending
    .then((status) => settle({ kind: 'harness_status', status }))
    .catch((error) => {
      warn('status request failed', error);
      settle({ kind: 'harness_status', status: null });
    });
}

// Recompute on every service-worker cold start so the stored snapshot can
// never outlive the browser's actual ruleset state.
currentStatus().catch((error) => warn('startup status failed', error));

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local
    .set({ harnessInstalledAt: new Date().toISOString() })
    .catch((error) => warn('install timestamp write failed', error));
  currentStatus().catch((error) => warn('install status failed', error));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    return false;
  }
  if(message?.kind==='demo_call'){
    demoRequest(message,sender).then(data=>sendResponse({data})).catch(()=>sendResponse({error:'Desktop unavailable or request refused.'}));
    return true;
  }
  if (message?.kind === 'harness_status') {
    respondWithStatus(currentStatus(), sendResponse);
    return true;
  }
  if (message?.kind === 'harness_toggle_fixture' && typeof message.enabled === 'boolean') {
    respondWithStatus(queueFixtureRuleUpdate(message.enabled), sendResponse);
    return true;
  }
  return false;
});
