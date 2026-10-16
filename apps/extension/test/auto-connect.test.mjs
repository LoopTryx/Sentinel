import test from 'node:test';
import assert from 'node:assert/strict';
import {autoConnect} from '../src/auto-connect.js';
test('native pairing returns only validated session credentials',async()=>{
 let stored;globalThis.chrome={runtime:{id:'c'.repeat(32),sendNativeMessage:async(name,data)=>{assert.equal(name,'com.looptryx.sentinel');assert.deepEqual(data,{operation:'connect'});return {port:12345,token:'a'.repeat(64),extensionId:'c'.repeat(32)};}},storage:{session:{set:async value=>{stored=value;}}}};
 try{assert.equal((await autoConnect()).port,12345);assert.equal(stored.sentinelDemoConnection.token,'a'.repeat(64));}finally{delete globalThis.chrome;}
});
test('wrong-extension credentials are never stored',async()=>{
 let stored=false;globalThis.chrome={runtime:{id:'c'.repeat(32),sendNativeMessage:async()=>({port:12345,token:'a'.repeat(64),extensionId:'d'.repeat(32)})},storage:{session:{set:async()=>{stored=true;}}}};
 try{await assert.rejects(autoConnect(),/connection_unavailable/);assert.equal(stored,false);}finally{delete globalThis.chrome;}
});
