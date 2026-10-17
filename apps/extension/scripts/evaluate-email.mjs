import {readFile,writeFile} from 'node:fs/promises';
import {assessEmail} from '../src/email/scoring.js';
import {inspectEmail} from '../src/email/technical.js';
import {emailDetectorConfig as baseline} from '../test/fixtures/email-baseline-config.js';
const samples=JSON.parse(await readFile(new URL('../test/fixtures/email-corpus.json',import.meta.url),'utf8'));
const results={};
for(const split of ['tuning','comparison','regression']){
 results[split]={};
 for(const mode of ['baseline','updated']){
  const stats={samples:0,scams:0,legitimate:0,falsePositives:0,falseNegatives:0};
  for(const item of samples.filter(s=>s.split===split)){
   const technical=mode==='baseline'?[]:inspectEmail(item.email);
   const flagged=(mode==='baseline'?assessEmail(item.email,{},technical,baseline):assessEmail(item.email,{},technical)).tier!=='Safe';
   stats.samples++;if(item.label==='scam'){stats.scams++;if(!flagged)stats.falseNegatives++;}else{stats.legitimate++;if(flagged)stats.falsePositives++;}
  }
  results[split][mode]=stats;
 }
}
const output={description:'Frozen initial email policy versus updated policy and technical checks. Sanitized historic public samples; not live-inbox accuracy.',results};
console.log(JSON.stringify(output,null,2));
if(process.argv.includes('--write'))await writeFile(new URL('../../../docs/evidence/email-evaluation.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
