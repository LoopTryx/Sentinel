import { statusLines } from './status.js';
import { generatePassword } from './password-generator.js';

const statusList = document.getElementById('harness-status');
const toggleButton = document.getElementById('fixture-toggle');

function renderLines(lines) {
  statusList.textContent = '';
  for (const line of lines) {
    const item = document.createElement('li');
    item.dataset.tone = line.tone;
    item.textContent = line.text;
    statusList.appendChild(item);
  }
}

function render(status) {
  const lines = statusLines(status);
  renderLines(lines);
  const fixtureState = status?.fixtureRule?.state;
  if (fixtureState === 'active' || fixtureState === 'disabled') {
    updateToggle(fixtureState);
  } else {
    toggleButton.disabled = true;
    toggleButton.textContent = 'Rule state unknown';
    toggleButton.removeAttribute('data-next-state');
  }
}

function updateToggle(fixtureState) {
  const enabling = fixtureState === 'disabled';
  toggleButton.disabled = false;
  toggleButton.dataset.nextState = enabling ? 'active' : 'disabled';
  toggleButton.textContent = enabling
    ? 'Block test domain (enable fixture rule)'
    : 'Allow test domain (disable fixture rule)';
  toggleButton.setAttribute(
    'aria-label',
    `${enabling ? 'Enable' : 'Disable'} the synthetic block rule for blocked.sentinel.invalid`
  );
}

async function requestStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ kind: 'harness_status' });
    render(response?.status ?? null);
  } catch {
    render(null);
  }
}

toggleButton.addEventListener('click', async () => {
  const nextState = toggleButton.dataset.nextState;
  if (nextState !== 'active' && nextState !== 'disabled') {
    return;
  }
  toggleButton.disabled = true;
  toggleButton.textContent = 'Updating rule…';
  try {
    const response = await chrome.runtime.sendMessage({
      kind: 'harness_toggle_fixture',
      enabled: nextState === 'active',
    });
    render(response?.status ?? null);
  } catch {
    render(null);
  }
});

requestStatus();

// On-demand local tools. Keep inputs in this document only, never in background storage.
import { explainUrl, explainMessage } from './local-checks.js';
const urlInput=document.getElementById('url-input');
const messageInput=document.getElementById('message-input');
function showResult(id, result) {
 window.dispatchEvent(new CustomEvent('sentinel-local-assessment',{detail:result}));
 const target=document.getElementById(id); target.replaceChildren();
 const heading=document.createElement('strong');
 heading.textContent=result.host ? `Destination: ${result.host} (${result.scheme}, port ${result.port})` : 'Local message clues';
 target.append(heading);
 const note=document.createElement('p'); note.textContent=result.risk==='unknown' ? 'No local warning clues · unknown. This does not establish safety.' : 'Review these local clues · partial coverage. This is not a malware verdict.'; target.append(note);
 const list=document.createElement('ul'); for(const reason of result.reasons){const item=document.createElement('li');item.textContent=reason.text;list.append(item);} target.append(list);
}
function errorResult(id,error){document.getElementById(id).textContent=error.message || 'Local check unavailable.';}
document.getElementById('check-url').addEventListener('click',()=>{try{showResult('url-result',explainUrl(urlInput.value));}catch(error){errorResult('url-result',error);}});
document.getElementById('check-message').addEventListener('click',()=>{try{showResult('message-result',explainMessage(messageInput.value));}catch(error){errorResult('message-result',error);}});
urlInput.addEventListener('input',()=>document.getElementById('url-result').replaceChildren());
messageInput.addEventListener('input',()=>document.getElementById('message-result').replaceChildren());
document.getElementById('check-tab').addEventListener('click',async()=>{
 try {const [tab]=await chrome.tabs.query({active:true,currentWindow:true}); if(!tab?.url || !/^https?:\/\//i.test(tab.url)) throw new Error('Open an HTTP/HTTPS page and use Sentinel from its toolbar button.'); showResult('url-result',explainUrl(tab.url));}
 catch {errorResult('url-result',new Error('Current-tab inspection unavailable here. Use the toolbar on an HTTP/HTTPS page or enter a URL manually.'));}
});
document.getElementById('open-dashboard').addEventListener('click',async()=>{try{await chrome.tabs.create({url:chrome.runtime.getURL('popup.html?view=dashboard')});}catch{errorResult('url-result',new Error('Dashboard unavailable outside the installed extension.'));}});
document.getElementById('clear-inputs').addEventListener('click',()=>{urlInput.value='';messageInput.value='';document.getElementById('url-result').replaceChildren();document.getElementById('message-result').replaceChildren();});
if(new URLSearchParams(location.search).get('view')==='dashboard') document.body.classList.add('dashboard');

const generated = document.getElementById('generated-password');
const copy = document.getElementById('copy-password');
const reveal = document.getElementById('reveal-password');
const feedback = document.getElementById('password-feedback');
let generation = 0;
function clearPassword() {
 generation++; generated.value = ''; generated.type = 'password'; copy.disabled = true;
 reveal.textContent = 'Show'; feedback.textContent = '';
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => {
 clearPassword();
 for (const tab of document.querySelectorAll('[data-view]')) tab.setAttribute('aria-pressed', String(tab === button));
 for (const panel of document.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== button.dataset.view;
});
document.getElementById('password-length').addEventListener('input', event => {
 document.getElementById('length-value').textContent = event.target.value; clearPassword();
});
document.getElementById('generate-password').addEventListener('click', () => {
 clearPassword();
 try {generated.value = generatePassword(Number(document.getElementById('password-length').value)); copy.disabled = false; feedback.textContent = 'Generated locally. Not saved.';}
 catch {feedback.textContent = 'Generation unavailable. Try again.';}
});
reveal.addEventListener('click', () => {generated.type = generated.type === 'password' ? 'text' : 'password'; reveal.textContent = generated.type === 'password' ? 'Show' : 'Hide';});
copy.addEventListener('click', async () => {
 const current = generation;
 try {await navigator.clipboard.writeText(generated.value); if (current === generation) feedback.textContent = 'Copied to clipboard. Other apps may read your clipboard.';}
 catch {if (current === generation) feedback.textContent = 'Copy unavailable. Select and copy the generated password manually.';}
});
document.getElementById('clear-password').addEventListener('click', clearPassword);
document.getElementById('clear-inputs').addEventListener('click', clearPassword);
window.addEventListener('pagehide', clearPassword);
