import {expect,it} from 'vitest';import {consoleScale} from './console-scale';
it('scales a presentation window while preserving a usable small-window layout',()=>{expect(consoleScale(1024,600)).toBe(1);expect(consoleScale(1366,768)).toBe(1);expect(consoleScale(1920,1080)).toBeGreaterThan(1.4);expect(consoleScale(3840,2160)).toBe(2);expect(consoleScale(1920,600)).toBe(1);});
