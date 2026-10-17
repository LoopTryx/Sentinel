import open from './assets/sounds/open.mp3';
import button from './assets/sounds/button.mp3';
import notification from './assets/sounds/notification.mp3';
import error from './assets/sounds/error.mp3';
import navigation from './assets/sounds/navigation.mp3';
const sources={open,button,notification,error,navigation};
export type UiSound=keyof typeof sources;
let enabled=true;try{enabled=localStorage.getItem('sentinel-ui-sounds')!=='off';}catch{}
let current:HTMLAudioElement|null=null,lastAt=-Infinity,lastKind:UiSound|null=null;
export const uiSoundsEnabled=()=>enabled;
export function setUiSoundsEnabled(value:boolean){enabled=value;try{localStorage.setItem('sentinel-ui-sounds',value?'on':'off');}catch{}if(!value){current?.pause();current=null;}}
export async function playUiSound(kind:UiSound){
 if(!enabled||typeof Audio==='undefined'||document.hidden)return false;
 const now=performance.now();if(lastKind===kind&&now-lastAt<(kind==='error'?2000:75))return false;
 lastKind=kind;lastAt=now;current?.pause();
 const audio=new Audio(sources[kind]);audio.volume=(kind==='button'||kind==='navigation')?.16:.22;current=audio;
 try{await audio.play();return true;}catch{if(current===audio)current=null;return false;}
}
export function installUiSounds(doc:Document){
 let disposed=false,openingPending=true;
 void playUiSound('open').then(played=>{if(!disposed&&played)openingPending=false;});
 const click=(event:MouseEvent)=>{if(!event.isTrusted)return;const target=event.target;if(!(target instanceof Element))return;const control=target.closest('button,a[href],[role="button"],summary');if(!control||control.matches(':disabled,[aria-disabled="true"]'))return;
  if(openingPending){openingPending=false;void playUiSound('open');return;}
  void playUiSound(control.closest('.sidebar-nav')?'navigation':'button');
 };
 doc.addEventListener('click',click,true);
 return()=>{disposed=true;doc.removeEventListener('click',click,true);current?.pause();current=null;};
}
