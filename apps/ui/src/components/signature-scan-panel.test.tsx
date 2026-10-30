// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {it,expect,vi} from 'vitest';
import SignatureScanPanel from './SignatureScanPanel';import {demoCall} from '../demo-bridge';
vi.mock('../demo-bridge',()=>({demoCall:vi.fn()}));(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('shows real current-file progress, scan counters and Stop without an invented percentage',async()=>{
 vi.mocked(demoCall).mockResolvedValue({available:true,signatures:3628111,definitionsFresh:true,scan:{state:'scanning',mode:'full',checkedFiles:42,skippedFiles:2,bytesChecked:104857600,currentFile:'C:\\Downloads\\large.zip',elapsedSeconds:65},findings:[]});
 const host=document.createElement('div');const root=createRoot(host);try{await act(async()=>root.render(<SignatureScanPanel/>));expect(host.querySelector('[aria-label="Scan progress"]')).toBeTruthy();expect(host.textContent).toContain('large.zip');expect(host.textContent).toContain('100 MB');expect(host.querySelector('[role="progressbar"]')?.hasAttribute('aria-valuenow')).toBe(false);expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Stop scan'))).toBeTruthy();}finally{await act(()=>root.unmount());}
});
