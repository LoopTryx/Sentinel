// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {installAiHandoff} from './ai-handoff';

describe('native AI handoff delivery',()=>{
  it('acknowledges only after the mounted receiver accepts a valid handoff',()=>{
    const ref='a'.repeat(32),received:unknown[]=[];
    const stop=installAiHandoff(window,document,value=>received.push(value));
    expect(document.documentElement.dataset.sentinelAiReady).toBe('true');
    window.dispatchEvent(new CustomEvent('sentinel-ai-handoff',{detail:{finding:{ref},question:'Explain this warning'}}));
    expect(received).toHaveLength(1);
    expect(document.documentElement.dataset.sentinelAiHandoffAck).toBe(ref);
    stop();expect(document.documentElement.dataset.sentinelAiReady).toBeUndefined();
    window.dispatchEvent(new CustomEvent('sentinel-ai-handoff',{detail:{finding:{ref},question:'Again'}}));
    expect(received).toHaveLength(1);
  });
  it('rejects malformed references without acknowledging delivery',()=>{
    const stop=installAiHandoff(window,document,()=>{throw Error('must not accept');});
    window.dispatchEvent(new CustomEvent('sentinel-ai-handoff',{detail:{finding:{ref:'invalid'},question:'Test'}}));
    expect(document.documentElement.dataset.sentinelAiHandoffAck).toBeUndefined();stop();
  });
});
