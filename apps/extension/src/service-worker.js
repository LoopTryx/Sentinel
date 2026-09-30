chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ harnessInstalledAt: new Date().toISOString() });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.kind !== 'harness_status') {
    return false;
  }
  sendResponse({
    kind: 'harness_status',
    fixtureBlocking: true,
    agentConnected: false,
    protectionScope: 'synthetic_fixture_only'
  });
  return false;
});
