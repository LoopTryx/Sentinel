// Redacted candidate excerpt and a bounded visible context tail may cross to the local desktop; never contact lists or whole inboxes.
export const messageSources={whatsapp:'https://web.whatsapp.com/',gmail:'https://mail.google.com/',outlook:'https://outlook.live.com/'};
export function messageExcerpt(text){
 if(typeof text!=='string'||!text.trim()||text.length>3000)throw Error('invalid_message');
 return text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g,' ')
 .replace(/(?:nvapi-|sk-)[A-Za-z0-9_-]{12,}/g,'[key removed]')
 .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email removed]')
 .replace(/\b(?:\d[ -]?){6,19}\b/g,'[number removed]')
 .replace(/((?:password|passcode|otp|token|secret|api[_ -]?key)\s*[:=]\s*)[^\s,;]+/gi,'$1[removed]')
 .replace(/https?:\/\/[^\s<>"']+/gi,value=>{try{const u=new URL(value);u.username='';u.password='';u.search='';u.hash='';return u.href;}catch{return '[link]';}}).slice(0,1800);
}
