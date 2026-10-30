import test from 'node:test';import assert from 'node:assert/strict';
import {createObservationMonitor} from './observation-monitor.mjs';
test('concurrent reads share one collection and stopped results are discarded',async()=>{
 let resolve,calls=0;const monitor=createObservationMonitor({collect:()=>{calls++;return new Promise(r=>{resolve=r;});},intervalMs:1000});
 const first=monitor.read(),second=monitor.read();await Promise.resolve();await Promise.resolve();assert.equal(calls,1);resolve({state:'partial'});assert.deepEqual(await first,{state:'partial'});assert.deepEqual(await second,{state:'partial'});await monitor.close();await assert.rejects(monitor.read(),/observation_unavailable/);
});
test('failed collection is not presented as a successful empty report',async()=>{const monitor=createObservationMonitor({collect:async()=>{throw Error('private raw error');},intervalMs:1000});try{await assert.rejects(monitor.read(),/observation_unavailable/);}finally{await monitor.close();}});
