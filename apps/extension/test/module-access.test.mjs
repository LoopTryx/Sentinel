import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {posix} from 'node:path';
const root=new URL('../',import.meta.url);
test('all page-loaded adapter imports are accessible on their own site',async()=>{
 const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
 for(const [entry,site] of [['src/whatsapp-inline.js','https://web.whatsapp.com/*'],['src/email/runtime.js','https://mail.google.com/*']]){
  const allowed=new Set(manifest.web_accessible_resources.filter(r=>r.matches.includes(site)).flatMap(r=>r.resources));const seen=new Set();
  async function visit(file){if(seen.has(file))return;seen.add(file);assert.ok(allowed.has(file),`${site}: missing ${file}`);const text=await readFile(new URL(file,root),'utf8');for(const m of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))await visit(posix.normalize(posix.join(posix.dirname(file),m[1])));}
  await visit(entry);
 }
});
