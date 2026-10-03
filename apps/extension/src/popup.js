import { statusLines } from './status.js';

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
document.getElementById('open-dashboard').addEventListener('click',()=>{chrome.tabs.create({url:chrome.runtime.getURL('popup.html?view=dashboard')}).catch(()=>errorResult('url-result',new Error('Dashboard unavailable outside the installed extension.')));});
document.getElementById('clear-inputs').addEventListener('click',()=>{urlInput.value='';messageInput.value='';document.getElementById('url-result').replaceChildren();document.getElementById('message-result').replaceChildren();});
if(new URLSearchParams(location.search).get('view')==='dashboard') document.body.classList.add('dashboard');
