// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {playUiSound,setUiSoundsEnabled,uiSoundsEnabled} from './ui-sounds';
afterEach(()=>{setUiSoundsEnabled(true);vi.unstubAllGlobals();vi.restoreAllMocks();});
it('plays quietly, replaces overlapping sounds and stops immediately on mute',async()=>{
 const created:any[]=[];vi.stubGlobal('Audio',class{volume=1;pause=vi.fn();play=vi.fn().mockResolvedValue(undefined);constructor(public src:string){created.push(this);}});
 setUiSoundsEnabled(true);expect(await playUiSound('button')).toBe(true);expect(created[0].volume).toBe(.16);
 expect(await playUiSound('error')).toBe(true);expect(created[0].pause).toHaveBeenCalled();expect(created[1].volume).toBe(.22);
 expect(await playUiSound('error')).toBe(false);expect(created).toHaveLength(2);
 expect(await playUiSound('navigation')).toBe(false);expect(created).toHaveLength(2);
 setUiSoundsEnabled(false);expect(created[1].pause).toHaveBeenCalled();expect(uiSoundsEnabled()).toBe(false);expect(localStorage.getItem('sentinel-ui-sounds')).toBe('off');expect(await playUiSound('notification')).toBe(false);
});
it('handles autoplay denial without throwing or changing app behaviour',async()=>{
 vi.stubGlobal('Audio',class{volume=1;pause=vi.fn();play=vi.fn().mockRejectedValue(new Error('NotAllowedError'));});
 setUiSoundsEnabled(true);expect(await playUiSound('open')).toBe(false);
});
