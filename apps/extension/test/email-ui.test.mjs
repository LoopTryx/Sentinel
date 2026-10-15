import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../ui/package.json',import.meta.url));const {JSDOM}=require('jsdom');
import {showEmailWarning} from '../src/email/banner.js';
import {guardEmailLinks} from '../src/email/link-guard.js';
test('safe mail has no banner, warnings stay compact and clean up',()=>{
 const dom=new JSDOM('<article></article>'),root=dom.window.document.querySelector('article');
 showEmailWarning(root,{tier:'Safe'});assert.equal(root.children.length,0);
 const cleanup=showEmailWarning(root,{tier:'Likely Scam',reasons:[{text:'Verify this request separately.'}]});
 assert.equal(root.querySelectorAll('[data-sentinel-email]').length,1);cleanup();assert.equal(root.children.length,0);
});
test('red-link guard requires confirmation, preserves original links and cleans up',()=>{
 const dom=new JSDOM('<article><a href="https://example.test/login">Bank</a></article>',{url:'https://mail.google.com'}),root=dom.window.document.querySelector('article'),link=root.querySelector('a');
 const cleanup=guardEmailLinks(root),event=new dom.window.MouseEvent('click',{bubbles:true,cancelable:true});
 link.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.ok(root.querySelector('[data-sentinel-email="confirmation"]'));
 assert.equal(link.getAttribute('href'),'https://example.test/login');cleanup();assert.equal(root.querySelector('[data-sentinel-email]'),null);
});
test('confirmation opens only the displayed destination and refuses stale or changed links',()=>{
 const dom=new JSDOM('<article><a href="https://first.example.test/">First</a><a href="https://second.example.test/">Second</a></article>',{url:'https://mail.google.com'}),doc=dom.window.document,root=doc.querySelector('article'),links=root.querySelectorAll('a');
 const opened=[];dom.window.open=(...args)=>opened.push(args);let dialog,current=true;
 const attach=dom.window.Element.prototype.attachShadow;dom.window.Element.prototype.attachShadow=function(options){const shadow=attach.call(this,options);dialog=shadow;return shadow;};
 const cleanup=guardEmailLinks(root,{isCurrent:()=>current});
 const click=link=>link.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));
 click(links[1]);assert.ok(dialog.textContent.includes('https://second.example.test/'));dialog.querySelectorAll('button')[1].click();
 assert.deepEqual(opened,[['https://second.example.test/','_blank','noopener,noreferrer']]);
 click(links[0]);links[0].href='https://changed.example.test/';dialog.querySelectorAll('button')[1].click();assert.equal(opened.length,1);
 click(links[1]);current=false;dialog.querySelectorAll('button')[1].click();assert.equal(opened.length,1);
 cleanup();dom.window.close();
});
