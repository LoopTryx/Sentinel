import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
async function get(url){
 const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Source download failed');
 const reader=r.body.getReader();let length=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>524288)throw new Error('Source too large');chunks.push(value);}}finally{await reader.cancel();}
 return Buffer.concat(chunks).toString('utf8');
}
const meta=JSON.parse(await get('https://api.github.com/repos/uBlockOrigin/uAssets/commits/master'));
if(!/^[a-f0-9]{40}$/.test(meta.sha))throw new Error('Invalid source commit');
const base='https://raw.githubusercontent.com/uBlockOrigin/uAssets/'+meta.sha+'/';
const source=await get(base+'filters/badware.txt');const license=await get(base+'LICENSE');
const candidates=source.split(/\r?\n/).map(l=>/^\|\|([a-z0-9.-]+)\^\$doc$/.exec(l.trim())?.[1]).filter(Boolean);
const exceptions=source.split(/\r?\n/).filter(l=>l.startsWith('@@')).join('\n');
const hosts=[...new Set(candidates)].filter(h=>h.includes('.')&&h.length<=253&&!exceptions.includes(h)).sort().slice(0,500);
if(hosts.length<10)throw new Error('Source yielded too few supported domains');
const snapshot={source:'uBlock Origin · Badware risks (domain-only subset)',sourceUrl:'https://github.com/uBlockOrigin/uAssets/blob/'+meta.sha+'/filters/badware.txt',sourceCommit:meta.sha,license:'GPL-3.0',capturedAt:new Date().toISOString(),sourceSha256:createHash('sha256').update(source).digest('hex'),hosts};
await mkdir(new URL('data/',root),{recursive:true});await mkdir(new URL('third-party/',root),{recursive:true});
await writeFile(new URL('data/badware-snapshot.js',root),'// Generated domain-only data; source and GPL-3.0 license in third-party/.\nexport default '+JSON.stringify(snapshot,null,2)+';\n');
await writeFile(new URL('third-party/uassets-badware.txt',root),source);await writeFile(new URL('third-party/uassets-LICENSE.txt',root),license);
console.log('Pinned source '+meta.sha+'; '+hosts.length+' supported risk-listed domains. No listed site fetched.');
