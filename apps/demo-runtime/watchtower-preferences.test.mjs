import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {dirname,join,resolve,sep} from 'node:path';import {fileURLToPath} from 'node:url';
import {createWatchtowerPreferences} from './watchtower-preferences.mjs';
test('trust persists, can be removed, while Allow once expires and never creates blocking authority',async()=>{
 const base=dirname(fileURLToPath(import.meta.url)),directory=await mkdtemp(join(base,'.watchtower-prefs-test-'));let now=0;const prefs=createWatchtowerPreferences(directory,{clock:()=>now});
 try{assert.equal((await prefs.change('example.com','trust')).state,'trusted');assert.deepEqual((await createWatchtowerPreferences(directory).snapshot()).trusted,['example.com']);await prefs.change('example.com','allow_once');assert.deepEqual((await prefs.snapshot()).allowedOnce,['example.com']);now=300001;assert.deepEqual((await prefs.snapshot()).allowedOnce,[]);await prefs.change('example.com','untrust');assert.deepEqual((await createWatchtowerPreferences(directory).snapshot()).trusted,[]);assert.equal((await prefs.snapshot()).blockingAvailable,false);await assert.rejects(prefs.change('https://example.com/private','trust'));}
 finally{assert.ok(resolve(directory).startsWith(resolve(base)+sep));await rm(directory,{recursive:true});}
});
