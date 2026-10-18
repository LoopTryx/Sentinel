import test from 'node:test';import assert from 'node:assert/strict';
import {assessDomain,normalizeDomain,watchtowerConfig} from './watchtower-domain.mjs';
import {assessMetadata} from './watchtower-observe.mjs';
import {report} from './watchtower-evaluate.mjs';
test('weak individual clues and legitimate IDNs do not flag a site',()=>{
 for(const domain of ['example.top','bit.ly','192.0.2.1','xn--bcher-kva.de','new-product-launch.io','a.b.c.d.example.com'])assert.equal(assessDomain(domain).tier,'Safe',domain);
});
test('brand identity plus hosting evidence raises a combined warning',()=>{
 const result=assessDomain('paypa1-login.top');assert.notEqual(result.tier,'Safe');assert.ok(result.reasons.some(r=>r.category==='identity'));assert.ok(result.reasons.some(r=>r.category==='hosting'));
 assert.equal(assessDomain('login.paypal.com').tier,'Safe');assert.equal(assessDomain('microsoft.com').trusted,true);
 const trusted=structuredClone(watchtowerConfig);trusted.trustedDomains=['paypa1-login.top'];assert.equal(assessDomain('paypa1-login.top',{},trusted).trusted,true);assert.equal(assessDomain('paypa1-login.top',{},trusted).tier,'Safe');
});
test('mixed script brand homographs and brand subdomains are explained',()=>{
 assert.ok(assessDomain('раураl.com').reasons.some(r=>r.code==='mixedScript'));
 assert.ok(assessDomain('paypal.verify.example.top').reasons.some(r=>r.code==='brandSubdomain'));
});
test('normalization refuses paths, full URLs, credentials and invalid names',()=>{
 for(const raw of ['https://example.com/a?token=secret','user@example.com','x.com\n','x..com','-x.com','a'.repeat(64)+'.com'])assert.equal(normalizeDomain(raw),null);
 assert.equal(normalizeDomain('EXAMPLE.COM.'),'example.com');assert.equal(normalizeDomain('2001:db8::1'),'2001:db8::1');
});
test('metadata remains bounded, excludes private paths and ages in-memory first-seen context',()=>{
 const history=new Map(),raw={version:1,dnsStatus:'available',connectionStatus:'available',domains:['paypa1-login.top','https://example.com/private?key=secret'],connections:[{address:'192.0.2.2',port:443,process:'browser'},{address:'192.0.2.3',port:443,process:'C:\\private\\app.exe'}]};
 const first=assessMetadata(raw,history,100),second=assessMetadata(raw,history,200);assert.equal(first.domains.length,1);assert.equal(first.domains[0].firstSeen,true);assert.equal(second.domains[0].firstSeen,false);assert.equal(first.connections.length,1);assert.ok(!JSON.stringify(first).includes('secret'));assert.equal(first.capabilities.blocking,false);assert.equal(first.capabilities.tls,false);
 assert.equal(assessMetadata(raw,history,watchtowerConfig.retention.minutes*60000+300).domains[0].firstSeen,true);
 assert.throws(()=>assessMetadata({...raw,domains:Array(1000).fill('x.test')}));
});
test('100-case public-feed and legitimate holdout is evaluated separately from synthetic tuning controls',()=>{
 const results=report();assert.equal(results.holdout.before.cases,100);assert.equal(results.holdout.before.falseNegatives,50);assert.equal(results.holdout.after.unavailable,0);assert.equal(results.holdout.after.falsePositives,0);assert.equal(results.syntheticControls.cases,5);
});
