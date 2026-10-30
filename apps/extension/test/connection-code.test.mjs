import test from 'node:test';import assert from 'node:assert/strict';
import {parseConnectionCode} from '../src/connection-code.js';
test('connection codes accept only bounded localhost ports and exact session tokens',()=>{
 const token='a'.repeat(64);assert.deepEqual(parseConnectionCode(`sentinel:14500:${token}`),{port:14500,token});
 for(const code of [`sentinel:999:${token}`,`sentinel:65536:${token}`,`https://evil.test:14500:${token}`,`sentinel:14500:${token}x`])assert.equal(parseConnectionCode(code),null);
});
