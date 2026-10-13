// Synthetic corpus only. Prints IDs/counts, never message bodies or sender identifiers.
import {readFile} from 'node:fs/promises';
import {explainMessage} from '../src/local-checks.js';
import {legacyExplainMessage} from '../test/fixtures/legacy-message-detector.mjs';
const corpus=JSON.parse(await readFile(new URL('../test/message-detector-corpus.json',import.meta.url),'utf8'));
export function evaluate(rows,classify) {
 const result={total:rows.length,scams:0,legitimate:0,truePositive:0,trueNegative:0,falsePositive:0,falseNegative:0,wrongIds:[]};
 for(const row of rows){const scam=row.label==='scam',flag=classify(row.text,row.context).risk==='suspicious';result[scam?'scams':'legitimate']++;result[scam?(flag?'truePositive':'falseNegative'):(flag?'falsePositive':'trueNegative')]++;if(flag!==scam)result.wrongIds.push(row.id);}
 result.falsePositiveRate=result.falsePositive/result.legitimate;result.falseNegativeRate=result.falseNegative/result.scams;return result;
}
const reports=[];
for(const split of ['tune','holdout','all']){
 const rows=split==='all'?corpus:corpus.filter(r=>r.split===split);
 reports.push({split,before:evaluate(rows,legacyExplainMessage),after:evaluate(rows,explainMessage)});
}
console.log(JSON.stringify(reports,null,2));
