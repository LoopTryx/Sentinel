import {emailExtractionLimits as limits} from '../../../data/email-extraction-config.js';

export function visible(node){
 if(!node?.isConnected)return false;
 for(let p=node,depth=0;p&&p.nodeType===1;p=p.parentElement,depth++){
  if(depth>64||p.hidden||p.getAttribute('aria-hidden')==='true')return false;
  const style=p.ownerDocument.defaultView?.getComputedStyle(p);
  if(style?.display==='none'||style?.visibility==='hidden')return false;
 }
 return true;
}
function clipped(value,max,field,truncated){
 if(typeof value!=='string')return null;
 if(value.length>max)truncated.add(field);
 return value.slice(0,max).trim()||null;
}
export function boundedText(root,max,truncated,field){
 if(!root)return null;
 const walker=root.ownerDocument.createTreeWalker(root,4);let text='',visited=0,node;
 while((node=walker.nextNode())){
  if(++visited>limits.textNodes){truncated.add(field);break;}
  if(node.parentElement?.closest('script,style,noscript,input,textarea,select,[contenteditable="true"],[hidden],[aria-hidden="true"],[data-sentinel-email],[data-sentinel-scam],[data-sentinel-ai]')||!visible(node.parentElement))continue;
  const value=node.nodeValue||'';
  if(text.length+value.length+1>max){text+=(text?' ':'')+value.slice(0,Math.max(0,max-text.length-1));truncated.add(field);break;}
  text+=(text?' ':'')+value;
 }
 return text.replace(/\s+/gu,' ').trim();
}
function outsideBody(root,selectors,body){
 for(const selector of selectors){for(const node of root.querySelectorAll(selector)){if(!body.contains(node)&&visible(node))return node;}}
 return null;
}
function address(value){
 if(typeof value!=='string'||value.length>limits.address)return null;
 const matches=value.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?/giu)||[];
 if(matches.length!==1||!matches[0].split('@')[1].includes('.'))return null;
 return matches[0].toLowerCase();
}
function senderAddress(node){
 if(!node)return null;
 for(const attr of ['email','data-email-address','data-email','title']){const found=address(node.getAttribute(attr));if(found)return found;}
 return address(boundedText(node,limits.address,new Set(),'senderAddress'));
}

/** All values are transient local data. Do not log, persist or send this snapshot to AI. */
export function readMessage(root,provider,selectors){
 const body=[...root.querySelectorAll(selectors.body)].find(node=>visible(node)&&!node.closest('[contenteditable="true"]'));
 if(!body)return null;
 const truncated=new Set();
 const senderNode=outsideBody(root,selectors.sender,body);
 const nameNode=outsideBody(root,selectors.name,body)||senderNode;
 const subjectNode=outsideBody(root,selectors.subject,body)||outsideBody(root.closest('[role="main"]')||root,selectors.subject,body);
 const sender={name:nameNode?boundedText(nameNode,limits.name,truncated,'senderName'):null,address:senderAddress(senderNode)};
 const subject=subjectNode?boundedText(subjectNode,limits.subject,truncated,'subject'):null;
 const bodyText=boundedText(body,limits.body,truncated,'body');
 let replyTo=null;const authentication={spf:'unavailable',dkim:'unavailable',dmarc:'unavailable'};
 const replyNode=outsideBody(root,selectors.replyTo,body);if(replyNode)replyTo=senderAddress(replyNode);
 // Client-exposed header rows only. Body claims about SPF/DKIM are not header evidence.
 const rows=[...root.querySelectorAll(selectors.headerRows)].filter(node=>!body.contains(node)&&visible(node));
 if(rows.length>limits.headerRows)truncated.add('headers');
 for(const row of rows.slice(0,limits.headerRows)){
  const cells=row.querySelectorAll('td,[role="cell"]');if(cells.length<2)continue;
  const label=(boundedText(cells[0],64,truncated,'headers')||'').toLowerCase();
  const value=boundedText(cells[1],limits.address,truncated,'headers')||'';
  if(/^reply[- ]to\s*:?.*$/u.test(label))replyTo=address(value);
  for(const kind of Object.keys(authentication))if(new RegExp(`^${kind}\\s*:?$`,'u').test(label)){
   const result=value.toLowerCase().match(/\b(pass|fail|softfail|neutral|temperror|permerror|none)\b/u);
   if(result)authentication[kind]=result[1];
  }
 }
 const allLinks=body.querySelectorAll('a[href]');if(allLinks.length>limits.links)truncated.add('links');
 const links=[];
 for(const node of [...allLinks].slice(0,limits.links)){
  const original=node.getAttribute('href');const raw=clipped(original,limits.href,'links',truncated);if(!raw)continue;
  let destination=null,scheme=null;
  try{if(original.length<=limits.href){const url=new URL(raw,root.ownerDocument.baseURI);if(url.href.length<=limits.href){destination=url.href;scheme=url.protocol;}else truncated.add('links');}}catch{/* Invalid/truncated destinations remain explicit, never silently approved. */}
  links.push({text:boundedText(node,limits.linkText,truncated,'links'),href:raw,destination,scheme});
 }
 const attachmentNodes=[...root.querySelectorAll(selectors.attachments)].filter(node=>!body.contains(node)&&visible(node));
 if(attachmentNodes.length>limits.attachments)truncated.add('attachments');
 const attachments=attachmentNodes.slice(0,limits.attachments).map(node=>clipped(node.getAttribute('data-filename')||node.getAttribute('title')||boundedText(node,limits.filename,truncated,'attachments'),limits.filename,'attachments',truncated)).filter(Boolean);
 return {provider,sender,replyTo,subject,body:bodyText,links,attachments,authentication,
  availability:{sender:sender.address?'observed':'unavailable',subject:subject!==null?'observed':'unavailable',replyTo:replyTo?'observed':'unavailable',authentication:Object.values(authentication).some(v=>v!=='unavailable')?'observed':'unavailable',attachments:attachmentNodes.length?'observed':'unavailable'},
  imageOnly:!bodyText&&body.querySelector('img')!==null,truncated:[...truncated],coverage:'partial'};
}

export function openedRoots(doc,selectors){
 return [...doc.querySelectorAll(selectors.roots)].filter(root=>visible(root)&&!root.closest(selectors.body)&&!root.closest('[contenteditable="true"]')).slice(0,limits.messages);
}
