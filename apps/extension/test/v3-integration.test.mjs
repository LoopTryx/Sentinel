import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('v3 integration preserves the v2 release extension identity and native connection permissions',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
 const id=createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 assert.equal(id,'cjmdcjnpmnpebifncdejcmhkgapnjdhh');
 assert.ok(manifest.permissions.includes('nativeMessaging'));
 assert.ok(manifest.host_permissions.includes('http://127.0.0.1/*'));
 const modules=manifest.web_accessible_resources.find(r=>r.matches.includes('https://web.whatsapp.com/*')).resources;
 assert.ok(modules.includes('src/message-detector.js'));assert.ok(modules.includes('data/message-detector-config.js'));
});
