import open from './assets/sounds/open.mp3';
import button from './assets/sounds/button.mp3';
import notification from './assets/sounds/notification.mp3';
import error from './assets/sounds/error.mp3';
import navigation from './assets/sounds/navigation.mp3';
const sources={open,button,notification,error,navigation,alert:notification};
const clips=new Map<UiSound,HTMLAudioElement>();
function clip(kind:UiSound){let audio=clips.get(kind);if(!audio){audio=new Audio(sources[kind]);audio.preload="auto";audio.volume=(kind==='button'||kind==='navigation')?.16:kind==='alert'?.30:.22;audio.load?.();clips.set(kind,audio);}return audio;}
export type UiSound=keyof typeof sources;
let enabled=true;try{enabled=localStorage.getItem('sentinel-ui-sounds')!=='off';}catch{}
let current:HTMLAudioElement|null=null,currentKind:UiSound|null=null,lastAt=-Infinity,lastKind:UiSound|null=null;
export const uiSoundsEnabled=()=>enabled;
export function setUiSoundsEnabled(value:boolean){enabled=value;try{localStorage.setItem('sentinel-ui-sounds',value?'on':'off');}catch{}if(!value){current?.pause();current=null;}}
export async function playUiSound(kind:UiSound){
 if(!enabled||typeof Audio==='undefined'||document.hidden)return false;
 const now=performance.now();if(lastKind===kind&&now-lastAt<(kind==='error'?2000:75))return false;
 if(current&&(currentKind==='alert'||currentKind==='error')&&!current.ended&&(kind==='button'||kind==='navigation'))return false;
 lastKind=kind;lastAt=now;current?.pause();
 const audio=clip(kind);try{audio.currentTime=0;}catch{}current=audio;currentKind=kind;
 try{await audio.play();return true;}catch{if(current===audio)current=null;return false;}
}
export function installUiSounds(doc:Document){
 let disposed=false,openingPending=true,lastPress=-Infinity;
 if(typeof Audio!=='undefined')for(const kind of Object.keys(sources) as UiSound[])clip(kind);
 void playUiSound('open').then(played=>{if(!disposed&&played)openingPending=false;});
 const controlFor=(event:Event)=>{if(!event.isTrusted||!(event.target instanceof Element))return null;const control=event.target.closest('button,a[href],[role="button"],summary');return control&&!control.matches(':disabled,[aria-disabled="true"]')?control:null;};
 const press=(event:PointerEvent)=>{if(event.button!==0)return;const control=controlFor(event);if(!control)return;lastPress=performance.now();void playUiSound(control.closest('.sidebar-nav')?'navigation':'button');};
 const click=(event:MouseEvent)=>{const control=controlFor(event);if(!control||performance.now()-lastPress<600)return;void playUiSound(control.closest('.sidebar-nav')?'navigation':'button');};
 const unlock=(event:Event)=>{if(!event.isTrusted||!openingPending)return;if(event.target instanceof Element&&event.target.closest('button,a,[role="button"],summary'))return;openingPending=false;void playUiSound('open');};
 doc.addEventListener('pointerdown',press,true);doc.addEventListener('click',click,true);doc.addEventListener('pointerdown',unlock,true);doc.addEventListener('keydown',unlock,true);
 return()=>{disposed=true;doc.removeEventListener('pointerdown',press,true);doc.removeEventListener('click',click,true);doc.removeEventListener('pointerdown',unlock,true);doc.removeEventListener('keydown',unlock,true);current?.pause();current=null;clips.clear();};
}
