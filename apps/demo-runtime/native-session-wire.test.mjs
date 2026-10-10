import test from 'node:test';
import assert from 'node:assert/strict';
import {validSessionMessage} from './native-session-wire.mjs';

test('restore pipe refuses destinations, retained originals and invented authority',()=>{
 const quarantine={actionRef:'a',selectionRef:'s',jobRef:'j',reportRef:'report_0',vaultFile:'a'.repeat(32)+'.qtn',state:'quarantined'};
 const good={type:'restore_preview',data:{restoreRef:'r',quarantine,expiresAfterSeconds:30}};
 assert.equal(validSessionMessage(good),true);
 for(const mutate of [m=>m.data.path='C:/private',m=>m.data.approved=true,m=>m.data.quarantine.state='original_retained',m=>m.data.quarantine.vaultFile='../a.qtn',m=>m.data.expiresAfterSeconds=31,m=>m.data.quarantine.reportRef='report_00',m=>m.type='restore_complete']){
  const m=structuredClone(good);mutate(m);assert.equal(validSessionMessage(m),false);
 }
 assert.equal(validSessionMessage({type:'restore_receipt',data:{restoreRef:'r',quarantine,state:'restored'}}),true);
 assert.equal(validSessionMessage({type:'error',data:{code:'action_failed',path:'private'}}),false);
});
