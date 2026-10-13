// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {expect,it} from 'vitest';import PasswordManagerView from './views/PasswordManagerView';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('disconnected account screen shows connection state instead of invented preview accounts',async()=>{
 const host=document.createElement('div');const root=createRoot(host);
 try{await act(()=>root.render(<PasswordManagerView/>));expect(host.textContent).toContain('Connecting');expect(host.textContent).not.toContain('Orbit Mail');expect(host.querySelectorAll('button')).toHaveLength(0);}finally{await act(()=>root.unmount());}
});
