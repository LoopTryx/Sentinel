import {browserOverview} from './browser-overview.js';
import {restoreMessageWarnings} from './message-registration.js';
import {restorePasswordTools} from './password-registration.js';
import {installPasswordPanel} from './password-panel.js';
import {installWarningNavigation} from './warning-navigation.js';
import {passwordCompanion} from './password-companion.js';
import {installWatchtowerSharing} from './watchtower-share.js';
import {installFloatingControl} from './floating-control.js';
import {navigationWarningStatus,setNavigationWarnings} from './navigation-policy.js';
import {whatsAppStatus,setWhatsAppWarnings} from './whatsapp-control.js';
import {installOmnibox} from './omnibox.js';
import { FIXTURE_RULESET_ID, computeStatus } from './status.js';
import {demoRequest} from './demo-transport.js';
import {messageAiRequest,messageAiError} from './message-ai-transport.js';
import {autoConnect} from './auto-connect.js';
import {installEmailControl} from './email/control.js';
installEmailControl(chrome);
let restoringMessages=null;const restoreMessages=()=>{if(restoringMessages)return;restoringMessages=restoreMessageWarnings(chrome).catch(()=>{}).finally(()=>{restoringMessages=null;});};
restoreMessages();chrome.runtime.onInstalled?.addListener(restoreMessages);chrome.runtime.onStartup?.addListener(restoreMessages);chrome.action?.onClicked?.addListener(restoreMessages);
installPasswordPanel(chrome);
const restorePasswords=()=>void restorePasswordTools(chrome).catch(()=>{});
restorePasswords();chrome.runtime.onInstalled?.addListener(restorePasswords);chrome.runtime.onStartup?.addListener(restorePasswords);chrome.action?.onClicked?.addListener(restorePasswords);
installWarningNavigation(chrome);
installWatchtowerSharing(chrome);
installFloatingControl(chrome);

const STATUS_KEY = 'harnessStatus';
// Existing nativeMessaging permission; no network or vault operation is replayed.
const connectDesktop=()=>{if(typeof chrome.runtime.sendNativeMessage==='function')void autoConnect().catch(()=>{});};
connectDesktop();chrome.runtime.onStartup?.addListener(connectDesktop);

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
  if(message?.kind==='browser_overview'){browserOverview(message,sender).then(sendResponse).catch(error=>sendResponse({error:error.message||'Connection unavailable'}));return true;}
  if(message?.kind==='password_companion'){passwordCompanion(message,sender).then(sendResponse).catch(error=>sendResponse({error:error.message||'Password operation unavailable.'}));return true;}
  if(message?.kind==='message_ai'){messageAiRequest(message,sender).then(sendResponse).catch(error=>{const failure=messageAiError(error);console.warn('SentinelAI connection:',failure.error);sendResponse(failure);});return true;}
  if(message?.kind==='whatsapp_content_status'){
    if(sender.frameId!==0||!Number.isInteger(sender.tab?.id)||!sender.url?.startsWith('https://web.whatsapp.com/'))return false;
    whatsAppStatus(chrome).then(sendResponse).catch(()=>sendResponse({enabled:false}));return true;
  }
  if(message?.kind==='whatsapp_status'||message?.kind==='whatsapp_toggle'){
    if(sender.url?.split(/[?#]/)[0]!==chrome.runtime.getURL('popup.html'))return false;
    if(message.kind==='whatsapp_toggle'&&typeof message.enabled!=='boolean')return false;
    const pending=message.kind==='whatsapp_status'?whatsAppStatus(chrome):queueWhatsAppUpdate(message.enabled);
    pending.then(sendResponse).catch(()=>sendResponse({error:'WhatsApp operation unavailable.'}));return true;
  }
  if(message?.kind==='navigation_status'||message?.kind==='navigation_toggle'){
    if(sender.url?.split(/[?#]/)[0]!==chrome.runtime.getURL('popup.html'))return false;
    if(message.kind==='navigation_toggle'&&typeof message.enabled!=='boolean')return false;
    const pending=message.kind==='navigation_status'?navigationWarningStatus(chrome):queueNavigationUpdate(message.enabled);
    pending.then(sendResponse).catch(error=>{warn('navigation rule update failed',error);sendResponse({error:'Navigation warning operation unavailable.'});});return true;
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

if(chrome.omnibox)installOmnibox(chrome);

let navigationUpdate=Promise.resolve();
function queueNavigationUpdate(enabled){const run=navigationUpdate.then(()=>setNavigationWarnings(chrome,enabled));navigationUpdate=run.catch(()=>{});return run;}
let whatsAppUpdate=Promise.resolve();
function queueWhatsAppUpdate(enabled){const run=whatsAppUpdate.then(()=>setWhatsAppWarnings(chrome,enabled));whatsAppUpdate=run.catch(()=>{});return run;}
chrome.permissions?.onRemoved?.addListener(()=>{chrome.permissions.contains({permissions:['scripting'],origins:['https://web.whatsapp.com/*']}).then(granted=>{if(!granted)return queueWhatsAppUpdate(false);}).catch(()=>{});});
