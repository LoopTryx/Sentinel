/** Local, bounded observations only. No requests, storage or safety verdicts. */
export function explainUrl(input) {
 if(typeof input!=='string' || new TextEncoder().encode(input).length>2048 || /[\s\x00-\x1f\x7f\\\u200b\u202a-\u202e\u2066-\u2069\ufeff]/u.test(input)) throw new Error('Enter an unambiguous HTTP or HTTPS URL, at most 2048 bytes.');
 if(!/^https?:\/\//i.test(input)) throw new Error('Only HTTP or HTTPS URLs are supported.');
 let url; try {url=new URL(input);} catch {throw new Error('This URL could not be parsed.');}
 if(!url.hostname) throw new Error('A destination host is required.');
 const reasons=[];
 if(url.username || url.password || input.split(/[/?#]/).slice(2,3).join('').includes('@')) reasons.push({code:'credentials',text:'Embedded credentials can disguise the actual destination. Verify the host shown below.'});
 if(url.protocol==='http:') reasons.push({code:'http',text:'HTTP does not encrypt traffic. Do not send private information over this connection.'});
 if(/^\[.*\]$/.test(url.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) reasons.push({code:'ip',text:'This destination is an IP address, not a named website. This alone does not establish a threat.'});
 if(url.hostname.split('.').some(part=>part.startsWith('xn--'))) reasons.push({code:'internationalized',text:'Internationalized host: review the full ASCII destination for lookalike naming.'});
 if(url.port) reasons.push({code:'port',text:'This URL uses a nondefault port. Verify it against the official service.'});
 return {host:url.hostname,scheme:url.protocol.slice(0,-1),port:url.port || (url.protocol==='https:'?'443':'80'),risk:reasons.length?'suspicious':'unknown',coverage:'partial',reasons,networkAccessed:false,reputationChecked:false};
}
export function explainMessage(input) {
 if(typeof input!=='string' || input.length>4096) throw new Error('Use an invented message of at most 4096 characters.');
 const patterns=[[/\b(urgent|immediately|act now|last chance)\b/i,'pressure','Urgency can pressure you into acting before verification.'],[/\b(otp|password|cvv|pin|verify your account)\b/i,'credentials','Requests for secrets require independent verification through the official service.'],[/\b(send money|processing fee|delivery fee|pay now)\b/i,'payment','Unexpected payment requests need verification outside this message.'],[/\b(winner|lottery|free gift|prize)\b/i,'reward','Unexpected rewards can be bait; verify the offer independently.'],[/http:\/\/|bit\.ly\/|tinyurl\.com\//i,'link','An insecure or shortened link hides useful destination information. Inspect the expanded official destination independently.']];
 const reasons=patterns.filter(([pattern])=>pattern.test(input)).map(([,code,text])=>({code,text}));
 return {risk:reasons.length?'suspicious':'unknown',coverage:'partial',reasons,networkAccessed:false};
}
