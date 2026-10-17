import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assessEmail} from '../src/email/scoring.js';
import {inspectEmail} from '../src/email/technical.js';
test('public research corpus contains 100 distinct labeled bounded samples with provenance',async()=>{
 const rows=JSON.parse(await readFile(new URL('./fixtures/email-corpus.json',import.meta.url),'utf8'));
 assert.ok(rows.length>=120);assert.equal(new Set(rows.filter(r=>r.sourceBodySha256).map(r=>r.sourceBodySha256)).size,100);
 assert.equal(rows.filter(r=>r.label==='scam').length,50);
 for(const row of rows){assert.ok(row.source);assert.ok(row.email.body.length<=8192);const result=assessEmail(row.email,{},inspectEmail(row.email));assert.ok(['Safe','Suspicious','Likely Scam'].includes(result.tier));if(row.split==='regression')assert.equal(result.tier,'Safe',row.id);}
});
