import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {inspectWithClamAV} from './clamav.mjs';
test('unknown bytes never enter the prepared ClamAV parser',async()=>{
 assert.equal((await inspectWithClamAV(Buffer.from('unknown sample'))).status,'unsupported');
});
test('verified installed ClamAV scans actual clean/marker bytes and honors pre-launch cancel',{skip:process.platform!=='win32'||!existsSync(new URL('../../.local-handoff/clamav-1.5.4/portable/clamav-1.5.4.win.x64/clamscan.exe',import.meta.url))},async()=>{
 const clean=await readFile(new URL('./samples/01-clean.txt',import.meta.url));const marker=await readFile(new URL('./samples/02-marker.txt',import.meta.url));
 assert.equal((await inspectWithClamAV(clean,()=>true)).status,'incomplete');
 assert.equal((await inspectWithClamAV(clean)).status,'no_detection');
 assert.equal((await inspectWithClamAV(marker)).status,'synthetic_match');
});
