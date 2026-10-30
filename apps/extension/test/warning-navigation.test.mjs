import test from 'node:test';import assert from 'node:assert/strict';
import {continueWarning,installWarningNavigation} from '../src/warning-navigation.js';
test('load completion preserves consent; closing the tab removes it',()=>{
 const changes=[];let update,remove;
 installWarningNavigation({runtime:{onMessage:{addListener(){}}},tabs:{onUpdated:{addListener:f=>update=f},onRemoved:{addListener:f=>remove=f}},declarativeNetRequest:{updateSessionRules:async r=>changes.push(r)}});
 update?.(7,{status:'complete'});assert.equal(changes.length,0);
 remove(7);assert.deepEqual(changes[0].removeRuleIds,[100007]);
});
test('continue is scoped to the warning tab and exact original URL',async()=>{
 const changes=[],updates=[];const api={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p},tabs:{update:async(...args)=>updates.push(args)},declarativeNetRequest:{updateSessionRules:async r=>changes.push(r)}};
 const sender={id:'test',frameId:0,tab:{id:7},url:'chrome-extension://test/warning.html#url=https://example.test/prize-fee?x=1'};
 await continueWarning({kind:'warning_continue'},sender,api);
 assert.deepEqual(updates,[[7,{url:'https://example.test/prize-fee?x=1'}]]);
 assert.deepEqual(changes[0].addRules[0].condition.tabIds,[7]);assert.equal(changes[0].addRules[0].condition.isUrlFilterCaseSensitive,true);
 const regex=new RegExp(changes[0].addRules[0].condition.regexFilter);
 assert.ok(regex.test(updates[0][1].url));assert.ok(!regex.test(updates[0][1].url+'extra'));
 await assert.rejects(continueWarning({kind:'warning_continue'},{...sender,frameId:1},api),/forbidden/);
 await assert.rejects(continueWarning({kind:'warning_continue'},{...sender,url:'https://evil.test/#url=https://example.test/'},api),/forbidden/);
 await assert.rejects(continueWarning({kind:'warning_continue'},{...sender,url:'chrome-extension://test/warning.html#url=javascript:alert(1)'},api),/invalid/);
});
