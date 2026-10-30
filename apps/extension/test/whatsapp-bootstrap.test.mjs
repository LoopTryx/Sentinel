import test from 'node:test';import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../src/whatsapp-bootstrap.js',import.meta.url),'utf8')).replace("import(chrome.runtime.getURL('src/whatsapp-inline.js'))",'loadModule()');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 let enabled=true,active=0;const listeners=[],intervals=[];
 const module={mountWhatsAppWarnings(){active++;let stopped=false;return {stop(){if(!stopped){stopped=true;active--;}}};}};
 const window={};window.top=window;
 const context=vm.createContext({location:{origin:'https://web.whatsapp.com'},window,document:{},chrome:{runtime:{id:'sentinel-test',sendMessage:async()=>({enabled}),getURL:p=>p,onMessage:{addListener:f=>listeners.push(f)}}},loadModule:async()=>module,setInterval:f=>{intervals.push(f);return intervals.length;},clearInterval:()=>{}});
 return {context,module,listeners,intervals,set enabled(value){enabled=value;},get active(){return active;},inject:()=>vm.runInContext(source,context),stop:()=>listeners[0]({kind:'whatsapp_stop'},{id:'sentinel-test'})};
}
test('bootstrap passes its isolated-world messaging API explicitly to the imported adapter',async()=>{const h=harness();let api;h.module.mountWhatsAppWarnings=(doc,value)=>{api=value;return {stop(){}};};h.inject();await tick();assert.equal(api,h.context.chrome);});
test('pause during module loading prevents observer mounting',async()=>{
 const h=harness();let release;h.context.loadModule=()=>new Promise(resolve=>{release=resolve;});
 h.inject();await tick();assert.equal(h.listeners.length,1);h.stop();release(h.module);await tick();assert.equal(h.active,0);
});
test('disabled reinjection stops existing observer before abandoning bootstrap',async()=>{
 const h=harness();h.inject();await tick();assert.equal(h.active,1);
 h.enabled=false;h.inject();await tick();assert.equal(h.active,0);
});
test('failed capability refresh removes active observer without message disclosure',async()=>{
 const h=harness();h.inject();await tick();assert.equal(h.active,1);
 h.context.chrome.runtime.sendMessage=async()=>{throw new Error('extension unavailable');};
 await h.intervals[0]();assert.equal(h.active,0);
});
