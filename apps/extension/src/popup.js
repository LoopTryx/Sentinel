const status = document.getElementById('harness-status');

try {
  const response = await chrome.runtime.sendMessage({ kind: 'harness_status' });
  status.textContent = response?.fixtureBlocking === true && response?.agentConnected === false
    ? 'Fixture rule active · Agent not connected'
    : 'Harness status unavailable';
} catch {
  status.textContent = 'Harness status unavailable';
}
