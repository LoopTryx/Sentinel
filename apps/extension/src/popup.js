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
