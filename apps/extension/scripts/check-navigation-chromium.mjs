// Optional real-browser regression check. Uses a disposable profile and never
// attaches to the owner's Chrome. Supply installed Playwright and Chromium paths.
import {createRequire} from 'node:module';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.SENTINEL_PLAYWRIGHT_MODULE || 'playwright');
const root=await mkdtemp(path.join(tmpdir(),'sentinel-navigation-test-'));
let context;
try{
 const extension=path.join(root,'extension');
 await cp(new URL('../dist/',import.meta.url),extension,{recursive:true});
 const manifestPath=path.join(extension,'manifest.json');
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 // Test-only host grants in a disposable extension/profile. The distributed
 // manifest keeps optional permissions and the owner's explicit opt-in.
 manifest.host_permissions=['http://*/*','https://*/*'];
 manifest.permissions.push('scripting');manifest.optional_permissions=[];
 await writeFile(manifestPath,JSON.stringify(manifest));
 context=await chromium.launchPersistentContext(path.join(root,'profile'),{executablePath:process.env.SENTINEL_CHROMIUM_EXE,channel:process.env.SENTINEL_CHROMIUM_EXE?undefined:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const base=worker.url().replace('/src/service-worker.js','/');
 const page=await context.newPage();await page.goto(base+'popup.html');
 const enabled=await page.evaluate(async()=>{
  const {setNavigationWarnings}=await import('./src/navigation-policy.js');
  return setNavigationWarnings(chrome,true);
 });
 assert.equal(enabled.enabled,true);
 for(const url of ['https://example.test/prize-payment','https://example.test/payment-prize','https://example.test/PRIZE-PAYMENT']){
  await page.goto(url);assert.equal(page.url(),base+'warning.html#keywords');
  assert.match(await page.locator('body').innerText(),/harmful|warning|suspicious/i);
 }
 await page.goto(base+'popup.html');
 const disabled=await page.evaluate(async()=>{
  const {setNavigationWarnings}=await import('./src/navigation-policy.js');
  const state=await setNavigationWarnings(chrome,false);
  return {...state,rules:await chrome.declarativeNetRequest.getDynamicRules()};
 });
 assert.equal(disabled.enabled,false);assert.equal(disabled.rules.length,0);
 // Synthetic DOM fixture: validates the observer and UI, not live WhatsApp coverage.
 await context.route('https://web.whatsapp.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div data-testid="msg-container"><span data-testid="tail-in"></span><div data-pre-plain-text="dummy"><span class="selectable-text">Come claim your free price of 100$!!</span></div></div><div data-testid="msg-container"><span data-testid="tail-out"></span><div data-pre-plain-text="dummy"><span class="selectable-text">URGENT: send money</span></div></div><div class="message-in"><div data-pre-plain-text="dummy"><span class="selectable-text">See you at school tomorrow</span></div></div></body></html>'}));
 const whatsapp=await context.newPage();await whatsapp.goto('https://web.whatsapp.com/');
 const waState=await page.evaluate(()=>chrome.runtime.sendMessage({kind:'whatsapp_toggle',enabled:true}));
 assert.equal(waState.enabled,true);assert.equal(waState.unavailableTabs,0);
 await whatsapp.waitForFunction(()=>document.querySelectorAll('[data-sentinel-scam]').length===1);
 await whatsapp.locator('[data-testid=tail-in]').first().evaluate(el=>{el.dataset.testid='tail-out';});
 await whatsapp.waitForFunction(()=>document.querySelectorAll('[data-sentinel-scam]').length===0,{},{timeout:1000});
 await whatsapp.locator('[data-testid=tail-out]').first().evaluate(el=>{el.dataset.testid='tail-in';});
 await whatsapp.waitForFunction(()=>document.querySelectorAll('[data-sentinel-scam]').length===1,{},{timeout:1000});
 await whatsapp.locator('[data-sentinel-scam] button').click();
 assert.match(await whatsapp.locator('[data-sentinel-scam] .detail').innerText(),/Checked locally/);
 await whatsapp.locator('[data-testid=msg-container] .selectable-text').first().evaluate(el=>{el.textContent='See you at school tomorrow';});
 await whatsapp.waitForFunction(()=>document.querySelectorAll('[data-sentinel-scam]').length===0);
 await whatsapp.locator('[data-testid=msg-container] .selectable-text').first().evaluate(el=>{el.textContent='URGENT: send money';});
 await whatsapp.waitForFunction(()=>document.querySelectorAll('[data-sentinel-scam]').length===1);
 // Tail-less consecutive bubbles have unknown direction: show wording, not an incoming verdict.
 await whatsapp.evaluate(()=>{const node=document.createElement('div');node.dataset.testid='msg-container';node.innerHTML='<span data-icon="pending"></span><div data-pre-plain-text="dummy"><span class="selectable-text">Come claim your free price of 100$!!</span></div>';document.body.append(node);});
 await whatsapp.waitForFunction(()=>document.querySelectorAll('[data-sentinel-scam]').length===2,{},{timeout:1000});
 const ambiguous=whatsapp.locator('[data-sentinel-scam]').last();
 assert.match(await ambiguous.locator('button').innerText(),/Suspicious wording/);
 await ambiguous.locator('button').click();
 assert.match(await ambiguous.locator('.detail').innerText(),/direction.*unavailable/i);
 await whatsapp.locator('[data-icon=pending]').evaluate(el=>{el.dataset.icon='msg-check';});
 await whatsapp.waitForFunction(()=>document.querySelectorAll('[data-sentinel-scam]').length===1,{},{timeout:1000});
 await page.evaluate(()=>chrome.runtime.sendMessage({kind:'whatsapp_toggle',enabled:false}));
 await whatsapp.waitForFunction(()=>document.querySelectorAll('[data-sentinel-scam]').length===0);
 console.log('PASS: synthetic WhatsApp DOM shows incoming and explicit unknown-direction clues, excludes confirmed outgoing, removes corrected warnings and cleans up on pause. Live WhatsApp remains a separate acceptance check.');
 console.log('PASS: actual Chromium accepted rules, redirected both keyword orders and uppercase, and removed rules on pause.');
}finally{
 await context?.close();
 // root comes directly from mkdtemp inside the OS temp directory.
 await rm(root,{recursive:true,force:true});
}
