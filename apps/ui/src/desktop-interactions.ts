export function installDesktopInteractions(document:Document){
 const prevent=(event:Event)=>event.preventDefault();
 document.addEventListener('contextmenu',prevent);document.addEventListener('dragstart',prevent);
 return()=>{document.removeEventListener('contextmenu',prevent);document.removeEventListener('dragstart',prevent);};
}
