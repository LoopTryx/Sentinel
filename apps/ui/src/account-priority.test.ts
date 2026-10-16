import {expect,it} from 'vitest';
import {accountPriority} from './account-priority';
it('flags weak and reused accounts before moderate strength and treats missing evidence as unknown',()=>{
 expect(accountPriority({health:'Very weak',reused:false})).toBe('high');
 expect(accountPriority({health:'Stronger',reused:true})).toBe('high');
 expect(accountPriority({health:'Moderate',reused:false})).toBe('medium');
 expect(accountPriority({health:'Stronger',reused:false})).toBe('low');
 expect(accountPriority({health:'Unknown',reused:false})).toBe('unknown');
});
