// @vitest-environment jsdom
import {expect,it} from 'vitest';import {installDesktopInteractions} from './desktop-interactions';
it('prevents context menu and dragging, preserves keyboard copying, and removes handlers cleanly',()=>{
 const dispose=installDesktopInteractions(document);for(const kind of ['contextmenu','dragstart']){const event=new Event(kind,{cancelable:true});document.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);}const key=new KeyboardEvent('keydown',{key:'c',ctrlKey:true,cancelable:true});document.dispatchEvent(key);expect(key.defaultPrevented).toBe(false);dispose();const next=new Event('contextmenu',{cancelable:true});document.dispatchEvent(next);expect(next.defaultPrevented).toBe(false);
});
