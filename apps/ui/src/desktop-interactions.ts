export function installDesktopInteractions(document:Document){
 const prevent=(event:Event)=>event.preventDefault();
 document.addEventListener('contextmenu',prevent);document.addEventListener('dragstart',prevent);
 return()=>{document.removeEventListener('contextmenu',prevent);document.removeEventListener('dragstart',prevent);};
}
export function canDragWindow(target:EventTarget|null,button:number){
 return button===0&&target instanceof Element&&!target.closest('button,input,textarea,select,a,[contenteditable="true"],[role="button"]');
}
