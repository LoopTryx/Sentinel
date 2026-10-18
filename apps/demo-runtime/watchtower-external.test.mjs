import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {createExternalChecks,certificateEvidence,publicIPv4} from './watchtower-external.mjs';
import {assessDomain} from './watchtower-domain.mjs';import {rememberBrowserDomain,browserDomains} from './watchtower-browser.mjs';
import {shareWatchtowerHostname} from '../extension/src/watchtower-share.js';import {startRuntime} from './server.mjs';
test('external checks are inert without explicit opt-in',async()=>{let calls=0;const checks=createExternalChecks({enabled:false,reputation:true,rdap:true,tls:true},{fetcher:()=>{calls++;throw Error();},certificate:()=>{calls++;}});await checks.schedule(['paypal.com'],['paypal.com']);assert.equal(calls,0);assert.equal(checks.read('paypal.com'),null);});
test('opted-in reputation and supported RDAP are bounded and supply explicit evidence',async()=>{
 const urls=[],checks=createExternalChecks({enabled:true,reputation:true,rdap:true,tls:false},{fetcher:async url=>{urls.push(url);return new Response(url.includes('raw.githubusercontent.com')?'https://phishing-fixture.com/path?not-forwarded=yes':JSON.stringify({events:[{eventAction:'registration',eventDate:new Date(Date.now()-86400000).toISOString()}]}));}});
 await checks.schedule(['phishing-fixture.com']);const evidence=checks.read('phishing-fixture.com');assert.equal(evidence.reputation.listed,true);assert.equal(evidence.age.status,'checked');assert.equal(urls.length,2);assert.ok(urls.every(url=>!url.includes('not-forwarded')));assert.notEqual(assessDomain('phishing-fixture.com',{external:evidence}).tier,'Safe');
});
test('TLS requires an opted-in observed browser domain and refuses private addresses',async()=>{
 let calls=0;const checks=createExternalChecks({enabled:true,tls:true},{certificate:async()=>{calls++;return {status:'unavailable'};}});await checks.schedule(['example.com']);assert.equal(calls,0);assert.equal(checks.read('example.com').tls.status,'requires_browser_observation');
 for(const ip of ['127.0.0.1','10.1.2.3','192.168.1.1','169.254.1.2','100.64.1.2','198.18.0.1','::1','2001:db8::1'])assert.equal(publicIPv4(ip),false);
 const result=await certificateEvidence('example.com',{resolve:async()=>[{address:'127.0.0.1'}],dial:()=>{throw Error('must not dial');}});assert.equal(result.status,'refused_private_destination');
});
test('diagnostic TLS reports certificate failures and destroys the socket without sending content',async()=>{
 const socket=new EventEmitter();socket.authorized=false;socket.authorizationError='DEPTH_ZERO_SELF_SIGNED_CERT';let destroyed=false;socket.destroy=()=>{destroyed=true;};socket.getPeerCertificate=()=>({raw:Buffer.from('fixture'),valid_from:'Jan 1 00:00:00 2020 GMT',valid_to:'Jan 1 00:00:00 2021 GMT',subjectaltname:'DNS:other.example',subject:{CN:'other.example'}});
 const result=await certificateEvidence('example.com',{resolve:async()=>[{address:'8.8.8.8'}],dial:(options,ready)=>{assert.equal(options.host,'8.8.8.8');assert.equal(options.servername,'example.com');queueMicrotask(ready);return socket;}});assert.equal(result.status,'checked');assert.ok(result.codes.includes('expiredCertificate'));assert.ok(result.codes.includes('mismatchedCertificate'));assert.ok(result.codes.includes('selfSignedCertificate'));assert.equal(destroyed,true);
});
test('browser sharing is off by default, excludes private tabs and sends only the hostname to paired localhost',async()=>{
 let enabled=false,calls=[];const api={runtime:{id:'a'.repeat(32)},storage:{local:{get:async()=>({watchtowerShareHostnames:enabled})},session:{get:async()=>({sentinelDemoConnection:{port:12345,token:'b'.repeat(64)}})}}};const send=async(url,options)=>{calls.push({url,body:options.body});};
 await shareWatchtowerHostname(api,'https://example.com/private?secret=1',{},send);assert.equal(calls.length,0);enabled=true;await shareWatchtowerHostname(api,'https://example.com/private?secret=1',{incognito:true},send);assert.equal(calls.length,0);await shareWatchtowerHostname(api,'https://example.com/private?secret=1',{},send);assert.deepEqual(calls,[{url:'http://127.0.0.1:12345/watchtower-domain',body:'{"host":"example.com"}'}]);
});
test('browser ingress grants no desktop read authority and expires its bounded memory',async()=>{
 const runtime=await startRuntime();try{const id='d'.repeat(32),headers={Authorization:'Bearer '+runtime.desktopToken,'Content-Type':'application/json'},pair=await(await fetch(runtime.url+'/pair',{method:'POST',headers,body:JSON.stringify({extensionId:id})})).json();
 const denied=await fetch(runtime.url+'/watchtower-domain',{method:'POST',headers,body:'{"host":"observed.example"}'});assert.equal(denied.status,403);
 const accepted=await fetch(runtime.url+'/watchtower-domain',{method:'POST',headers:{...headers,Authorization:'Bearer '+pair.token,'X-Sentinel-Extension':id},body:'{"host":"observed.example"}'});assert.equal(accepted.status,200);assert.deepEqual(await accepted.json(),{ok:true});assert.ok(browserDomains().includes('observed.example'));
 }finally{await runtime.close();}rememberBrowserDomain('expired.example',1);assert.ok(!browserDomains(10000000).includes('expired.example'));
});
