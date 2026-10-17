(()=>{
 if(window.top!==window||globalThis.__sentinelEmailStarted)return;
 globalThis.__sentinelEmailStarted=true;
 import(chrome.runtime.getURL('src/email/runtime.js')).then(m=>m.startEmailWarnings(document,chrome)).catch(()=>{globalThis.__sentinelEmailStarted=false;});
})();
