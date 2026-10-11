import {describe, expect, it} from 'vitest';
import {parseUsbInventory, usbFreshness, MAX_REPORT_BYTES} from './inventory';

const now = Date.UTC(2026, 9, 10, 12);
const report = () => ({schemaVersion:1, mode:'observation_only', state:'observed', observedAt:new Date(now).toISOString(), omitted:0, devices:[{ref:'device-1', usbEvidence:'os_reported', interfaces:['storage','hid_keyboard']} ]});
describe('USB observation boundary', () => {
  it('keeps storage and HID separate in a composite observation', () => {
    const result = parseUsbInventory(JSON.stringify(report()), now);
    expect(result?.devices[0].interfaces).toEqual(['storage','hid_keyboard']);
    expect(result?.mode).toBe('observation_only');
  });
  it('accepts an observed empty inventory without granting protection', () => {
    expect(parseUsbInventory(JSON.stringify({...report(),devices:[]}), now)?.state).toBe('observed');
  });
  it('rejects injected action authority and duplicate references', () => {
    expect(parseUsbInventory(JSON.stringify({...report(),hidBlocked:true}), now)).toBeNull();
    const device = report().devices[0];
    expect(parseUsbInventory(JSON.stringify({...report(),devices:[device,device]}), now)).toBeNull();
  });
  it('bounds bytes, devices, interfaces and numeric fields before use', () => {
    expect(parseUsbInventory(' '.repeat(MAX_REPORT_BYTES + 1), now)).toBeNull();
    expect(parseUsbInventory(JSON.stringify({...report(),devices:Array.from({length:65},(_,i)=>({...report().devices[0],ref:`device-${i+1}`}))}), now)).toBeNull();
    for (const omitted of [-1,0.5,Infinity,513]) expect(parseUsbInventory(JSON.stringify({...report(),omitted}), now)).toBeNull();
    expect(parseUsbInventory(JSON.stringify({...report(),devices:[{...report().devices[0],interfaces:['storage','storage']}]}), now)).toBeNull();
  });
  it('preserves failure and incomplete states and rejects contradictory snapshots', () => {
    expect(parseUsbInventory(JSON.stringify({...report(),state:'partial',omitted:1}), now)?.state).toBe('partial');
    expect(parseUsbInventory(JSON.stringify({...report(),state:'unavailable',devices:[]}), now)?.state).toBe('unavailable');
    expect(parseUsbInventory(JSON.stringify({...report(),state:'unavailable'}), now)).toBeNull();
    expect(parseUsbInventory(JSON.stringify({...report(),omitted:1}), now)).toBeNull();
  });
  it('rejects malformed/future times and marks expired/rollback observations stale', () => {
    expect(parseUsbInventory(JSON.stringify({...report(),observedAt:'tomorrow'}), now)).toBeNull();
    expect(parseUsbInventory(JSON.stringify({...report(),observedAt:new Date(now+6000).toISOString()}), now)).toBeNull();
    const value=parseUsbInventory(JSON.stringify(report()), now)!;
    expect(usbFreshness(value,now+59000)).toBe('recent snapshot');
    expect(usbFreshness(value,now+60000)).toBe('stale snapshot');
    expect(usbFreshness(value,now-1)).toBe('stale snapshot');
  });
});
