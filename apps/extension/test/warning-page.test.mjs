import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import snapshot from '../data/badware-snapshot.js';
import {listState} from '../src/navigation-policy.js';

const source=(await readFile(new URL('../src/warning.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
function render(hash){
 const element=()=>({textContent:'',style:{},children:[],append(...children){this.children.push(...children);},setAttribute(){},addEventListener(){}});
 const nodes=new Map(['classification','summary','reasons','list-status','list-source'].map(id=>[id,{textContent:'',hidden:false,children:[],append(child){this.children.push(child);}}]));
 const document={body:{dataset:{}},getElementById:id=>nodes.get(id),querySelector:()=>element(),createElement:()=>element()};
 runInNewContext(source,{document,window:{addEventListener(){}},location:{hash},snapshot,listState,pendingAiHandoff:async()=>null,handoffInput:()=>{throw Error('Original URL unavailable');}});
 return {nodes,document};
}
test('keyword warnings do not imply domain-list coverage or a proven fraud verdict',()=>{
 const {nodes,document}=render('#keywords');
 assert.equal(document.body.dataset.risk,'keywords');
 assert.equal(nodes.get('list-status').hidden,true);
 assert.match(nodes.get('reasons').children[0].textContent,/does not prove fraud/);
 assert.match(nodes.get('list-source').textContent,/URL wording only/);
});
test('listed warnings retain actual freshness, uncertainty and bundled attribution',()=>{
 const {nodes,document}=render('#listed');
 assert.equal(document.body.dataset.risk,'listed');
 assert.equal(nodes.get('list-status').hidden,false);
 assert.ok(nodes.get('list-status').textContent.includes(listState(snapshot).replaceAll('_',' ')));
 assert.ok(nodes.get('list-status').textContent.includes(snapshot.capturedAt.slice(0,10)));
 assert.match(nodes.get('reasons').children[0].textContent,/not a fresh malware verdict/);
 assert.match(nodes.get('list-source').textContent,/GPL-3.0/);
});
