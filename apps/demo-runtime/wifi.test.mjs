import test from 'node:test';import assert from 'node:assert/strict';
import {validateObservation,assessObservation} from './wifi.mjs';
import {startRuntime} from './server.mjs';
const observation={connection:'wifi',profile:'public',security:'open',gateway:'configured',dns:'configured',vpn:'unknown',proxy:'unknown'};
test('open Wi-Fi explains link risk without inventing interception or a safe verdict',()=>{const report=assessObservation(observation);assert.equal(report.checks[0].title,'Open Wi-Fi');assert.match(report.checks[0].detail,/HTTPS still protects/);assert.equal(report.coverage,'passive');assert.equal(report.safe,undefined);});
test('unknown coverage creates no fictional threats and raw identities are refused',()=>{assert.equal(validateObservation({...observation,ssid:'private'}),null);assert.equal(validateObservation({...observation,security:'safe'}),null);assert.equal(validateObservation(observation).security,'open');assert.equal(assessObservation({...observation,profile:'unknown',security:'unknown'}).checks.length,0);});
test('paired browser cannot collect desktop network observations',async()=>{
 const runtime=await startRuntime();try{
  const id='c'.repeat(32);const pairing=await fetch(runtime.url+'/pair',{method:'POST',headers:{Authorization:'Bearer '+runtime.desktopToken,'Content-Type':'application/json'},body:JSON.stringify({extensionId:id})});const config=await pairing.json();
  const response=await fetch(runtime.url+'/wifi',{method:'POST',headers:{Authorization:'Bearer '+config.token,'X-Sentinel-Extension':id,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
 }finally{await runtime.close();}
});
