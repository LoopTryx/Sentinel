import {expect,it} from 'vitest';
import {isDemoState} from './demo-state';
it('rejects nested malformed native state instead of crashing the connected UI',()=>{
 const state={revision:0,mode:'synthetic_demo',connected:true,unlocked:false,extensionId:'',accounts:[],events:[],scan:null};
 expect(isDemoState(state)).toBe(true);expect(isDemoState({...state,mode:'encrypted_vault'})).toBe(true);expect(isDemoState({...state,mode:'unknown'})).toBe(false);
 for(const patch of [{unlocked:'yes'},{revision:-1},{accounts:[{}]},{events:[{id:'a',at:'now',source:'browser',kind:'x',codes:{}}]},{scan:{status:'safe'}},{extensionId:'https://foreign.test'}])expect(isDemoState({...state,...patch})).toBe(false);
 const scan={id:'a',status:'running',coverage:'partial',engine:'test',visited:0,checked:0,skipped:0,errors:0,bytes:0,files:[],findings:[]};
 expect(isDemoState({...state,scan})).toBe(true);
 expect(isDemoState({...state,scan:{...scan,status:['running']}})).toBe(false);
 expect(isDemoState({...state,events:[{id:'a',at:'now',source:['browser'],kind:'test',codes:[]}]})).toBe(false);
 expect(isDemoState({...state,accounts:[{id:'a',name:'a',user:'a',host:'a',health:['Weak'],reused:false,reasons:[]}]})).toBe(false);
});
