import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const release=await read('version.json');
if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(release.version)||release.tag!=='v'+release.version)throw Error('Invalid release metadata');
for(const path of ['package.json','apps/ui/package.json','apps/extension/manifest.json']){
  if((await read(path)).version!==release.version)throw Error('Release version mismatch: '+path);
}
console.log('Release, workspace, UI and extension versions agree: '+release.tag);
