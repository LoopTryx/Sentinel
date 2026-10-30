import {messageExcerpt} from './message-ai-data.js';
import {boundedText,visible} from './email/providers/shared.js';
// Candidate vocabulary, not a verdict. Ordinary warnings and quoted examples
// intentionally reach contextual review instead of being called scams by regex.
export const candidateCategories=Object.freeze({
 urgency:['urgent','immediately','act now','final warning','last chance','limited time','within 24 hours','expires today','respond now','do not delay','action required','time sensitive'],
 accounts:['account suspended','account locked','account closed','verify account','confirm identity','unusual activity','security alert','login attempt','reset password','update credentials','reactivate account','verify your identity'],
 credentials:['password','passcode','one time password','verification code','otp','recovery code','seed phrase','private key','security code','authentication code','backup code','login code'],
 payments:['pay now','payment required','processing fee','customs fee','delivery fee','advance fee','transfer money','wire transfer','bank transfer','payment link','unpaid invoice','outstanding balance'],
 rewards:['you won','winner','lottery','jackpot','claim prize','claim reward','free gift','cash prize','selected winner','lucky draw','giveaway','congratulations'],
 investment:['guaranteed return','risk free','double your money','investment opportunity','crypto investment','daily profit','trading signal','passive income','get rich','exclusive investment','guaranteed profit','financial freedom'],
 impersonation:['ceo','boss','manager needs','bank support','technical support','customer support','government department','tax authority','police notice','court notice','official representative','help desk'],
 secrecy:['keep this confidential','do not tell','secret transaction','between us','discreetly','confidential request','dont call','do not call','use this number','new number','lost my phone','changed my number'],
 jobs:['work from home','easy money','earn daily','task commission','job offer','recruitment fee','training fee','part time job','no experience needed','salary advance','receive payments','payment agent'],
 delivery:['parcel','package held','delivery failed','shipment pending','confirm address','reschedule delivery','tracking link','customs clearance','delivery attempt','post office','address incomplete','courier'],
 remote:['remote access','install anydesk','install teamviewer','screen sharing','download attachment','enable macros','disable antivirus','install app','open attachment','run this file','support session','allow access'],
 coercion:['arrest warrant','legal action','penalty','fine overdue','tax refund','refund pending','compromised','infected','blackmail','expose you','family emergency','hospital bill'],
 purchase:['gift card','voucher code','refund request','buyer protection','escrow payment','off platform','deposit required','booking fee','reservation fee','payment receipt','overpayment','cashback']
});
const phrases=Object.values(candidateCategories).flat();
export function isMessageCandidate(text){if(typeof text!=='string'||text.length>4096)return false;const normalized=text.normalize('NFKC').toLowerCase().replace(/[’']/g,'').replace(/\s+/g,' ');return phrases.some(p=>normalized.includes(p));}
export function prepareMessageContext(rows=[]){if(!Array.isArray(rows)||rows.length>100||rows.some(x=>typeof x!=='string'||x.length>3000))throw Error('invalid_context');return rows.slice(-3).map(x=>messageExcerpt(x).slice(0,300)).filter(Boolean);}
export function priorVisibleText(nodes,current,selector){const index=nodes.indexOf(current);if(index<0)return [];return prepareMessageContext(nodes.slice(Math.max(0,index-3),index).filter(visible).map(n=>Array.from(n.querySelectorAll(selector)).filter(visible).map(p=>boundedText(p,300,new Set(),'context')||'').join(' ').slice(0,900)));}
