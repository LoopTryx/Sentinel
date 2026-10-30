export function mountContinue(doc,api,ref){
 const button=doc.getElementById('open-sentinel'),status=doc.getElementById('status');
 doc.getElementById('return').addEventListener('click',event=>{event.preventDefault();doc.defaultView.close();});
 if(!/^[a-f0-9]{32}$/.test(ref)){button.disabled=true;status.textContent='Reopen the warning to continue in Sentinel.';return;}
 let busy=false;
 button.addEventListener('click',async()=>{if(busy)return;busy=true;button.disabled=true;status.textContent='Opening Sentinel…';
  try{const response=await api.runtime.sendMessage({kind:'demo_call',method:'ai-open',data:{ref}});if(!response||response.error||response.data?.ok!==true)throw Error();status.textContent='Sentinel is open. Continue there, or return to your message.';}
  catch{status.textContent='Could not open this warning. Start Sentinel or reopen the message, then try again.';}
  finally{busy=false;button.disabled=false;}
 });
}
if(typeof document!=='undefined'&&typeof chrome!=='undefined')mountContinue(document,chrome,location.hash.slice(1));
