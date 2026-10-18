import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectEmail} from '../src/email/technical.js';
import {assessEmail} from '../src/email/scoring.js';
const email=overrides=>({sender:{name:'Example',address:'notice@example.com'},replyTo:null,subject:'Notice',body:'Your scheduled delivery is tomorrow.',links:[],attachments:[],authentication:{spf:'unavailable'},...overrides});
test('technical checks inspect only exposed metadata and use fixed explanations',()=>{
 const sample=email({replyTo:'reply@other.example',authentication:{spf:'fail'},links:[{text:'https://paypal.com',destination:'https://paypa1.example/login?private=secret'}],attachments:['invoice.pdf.exe']});
 const result=inspectEmail(sample),codes=result.map(s=>s.code);
 for(const code of ['replyTo','authentication','linkMismatch','riskyLink','dangerousAttachment','doubleExtension'])assert.ok(codes.includes(code),code);
 assert.ok(!JSON.stringify(result).includes('secret'));
 assert.notEqual(assessEmail(sample,{},result).tier,'Safe');
});
test('ordinary links, absent headers and body header claims do not invent evidence',()=>{
 const sample=email({body:'SPF fail. Delivery tomorrow.',links:[{text:'Track delivery',destination:'https://example.com/track'}]});
 assert.deepEqual(inspectEmail(sample).map(s=>s.code),['shortBody']);
 assert.equal(assessEmail(sample,{},inspectEmail(sample)).tier,'Safe');
});
test('a single attachment or mixed-script clue cannot flag alone',()=>{
 for(const sample of [email({attachments:['document.docm']}),email({subject:'Pаypal notice'})])assert.equal(assessEmail(sample,{},inspectEmail(sample)).tier,'Safe');
});
test('fake thread requires explicit absence and filename checks never execute attachments',()=>{
 assert.ok(!inspectEmail(email({subject:'RE: invoice'})).some(s=>s.code==='fakeThread'));
 assert.ok(inspectEmail(email({subject:'RE: invoice',threadExists:false})).some(s=>s.code==='fakeThread'));
 assert.ok(inspectEmail(email({attachments:['documents.zip'],body:'Password is provided separately.'})).some(s=>s.code==='passwordArchive'));
});
