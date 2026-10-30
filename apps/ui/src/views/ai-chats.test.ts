import {expect,it} from 'vitest';import {newChat,completeChat} from './ai-chats';
it('a delayed analysis updates only its original chat',()=>{const a=newChat(),b=newChat();const chats=completeChat([a,b],a.id,{id:'result',role:'assistant',tier:'deep',text:'First chat result'});expect(chats[0].messages[0].text).toBe('First chat result');expect(chats[1]).toBe(b);});
it('deleted chats are never recreated by stale responses',()=>{const a=newChat();expect(completeChat([],a.id,{id:'late',role:'assistant',text:'late'})).toEqual([]);});

import {historySnapshot,restoreHistory} from './ai-chats';
it('restores completed messages without restoring authorization references, pending work or drafts',()=>{const chat=newChat();chat.messages=[{id:'m',role:'user',text:'hello'}];chat.draft='unsent';chat.phase='deep';const restored=restoreHistory(historySnapshot([chat]));expect(restored[0].messages[0].text).toBe('hello');expect(restored[0].finding).toBeNull();expect(restored[0].draft).toBe('');expect(restored[0].phase).toBe('ready');expect(restoreHistory({chats:[{...chat,messages:[{role:'system',text:'bad'}]}]})).toEqual([]);});

it('evicts oldest saved text before the native envelope exceeds its bound',()=>{const chats=Array.from({length:24},()=>{const c=newChat();c.messages=Array.from({length:60},()=>({id:crypto.randomUUID(),role:'assistant' as const,text:'x'.repeat(12000)}));return c;});const snapshot=historySnapshot(chats);expect(JSON.stringify(snapshot).length).toBeLessThanOrEqual(500000);expect(snapshot.chats[0].id).toBe(chats[0].id);});
