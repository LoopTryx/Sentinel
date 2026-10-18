import { statusLines } from './status.js';
document.addEventListener('contextmenu',event=>event.preventDefault());
document.addEventListener('dragstart',event=>event.preventDefault());


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


for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{for(const tab of document.querySelectorAll('[data-view]'))tab.setAttribute('aria-pressed',String(tab===button));for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==button.dataset.view;});
const embeddedOverlay=new URLSearchParams(location.search).get('overlay')==='1';
if(embeddedOverlay){document.documentElement.classList.add('embedded-overlay');document.addEventListener('keydown',event=>{if(event.key==='Escape')window.parent.postMessage('sentinel-overlay-close','*');});}
document.getElementById('open-dashboard').onclick=()=>{if(embeddedOverlay)return;chrome.tabs.create({url:chrome.runtime.getURL('popup.html?view=dashboard')});};
if(['dashboard','settings','passwords'].includes(new URLSearchParams(location.search).get('view')))document.body.classList.add('dashboard');

if(new URLSearchParams(location.search).get('view')==='passwords'){for(const tab of document.querySelectorAll('[data-view]'))tab.setAttribute('aria-pressed',String(tab.dataset.view==='passwords'));for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!=='passwords';}
if(location.hash==='#floating-unavailable'){const note=document.createElement('p');note.setAttribute('role','status');note.textContent='Floating panel unavailable here. Use these extension controls.';document.querySelector('main').prepend(note);}
