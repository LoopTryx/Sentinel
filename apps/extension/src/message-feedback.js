/** Tab-local, bounded aggregate feedback. Never accepts text, identifiers or URLs. */
export function createMessageFeedback() {
 const counts={Suspicious:0,'Likely Scam':0,Safe:0};
 const categories={reward:0,action:0,urgency:0,credentials:0,authority:0,link:0};
 return {
  report(tier,matched=[]){if(!Object.hasOwn(counts,tier)||!Array.isArray(matched)||matched.length>6||matched.some(c=>!Object.hasOwn(categories,c)))throw new Error('Invalid feedback tier/categories.');counts[tier]=Math.min(10000,counts[tier]+1);for(const c of new Set(matched))categories[c]=Math.min(10000,categories[c]+1);return {...counts};},
  snapshot(){return {...counts};},
  export(){return {schemaVersion:1,tiers:{...counts},categories:{...categories}};},
  clear(){for(const group of [counts,categories])for(const key of Object.keys(group))group[key]=0;}
 };
}
