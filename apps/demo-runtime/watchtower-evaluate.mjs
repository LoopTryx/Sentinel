import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assessDomain} from './watchtower-domain.mjs';
export function evaluate(cases,classify){
 const totals={cases:cases.length,truePositives:0,trueNegatives:0,falsePositives:0,falseNegatives:0,unavailable:0};
 for(const row of cases){const result=classify(row.domain);if(!result){totals.unavailable++;continue;}const flagged=result.tier!=='Safe',malicious=row.label==='malicious';totals[flagged?(malicious?'truePositives':'falsePositives'):(malicious?'falseNegatives':'trueNegatives')]++;}
 return totals;
}
export function report(){
 const fixture=JSON.parse(readFileSync(new URL('./test/fixtures/watchtower-domains.json',import.meta.url),'utf8'));
 return {provenance:fixture.provenance,scope:'Hostname-only indicators. URL feed labels do not prove the whole host malicious. Suspicious and Likely Malicious both count as flagged. No lookup or connection is made.',holdout:{before:evaluate(fixture.cases.filter(c=>c.split==='holdout'),()=>({tier:'Safe'})),after:evaluate(fixture.cases.filter(c=>c.split==='holdout'),assessDomain)},syntheticControls:evaluate(fixture.cases.filter(c=>c.split==='synthetic'),assessDomain)};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)console.log(JSON.stringify(report(),null,2));
