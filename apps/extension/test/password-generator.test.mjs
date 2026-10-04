import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { generatePassword } from '../src/password-generator.js';
test('generates bounded passwords with the actual crypto provider', () => {
 for (const length of [12, 20, 48]) assert.match(generatePassword(length, webcrypto), new RegExp(`^[a-zA-Z2-9!@#$%*\\-_+?]{${length}}$`));
 for (const length of [0, 49, 20.5, '20']) assert.throws(() => generatePassword(length, webcrypto));
});
test('rejects biased high bytes and bounds a failing random provider', () => {
 let calls = 0;
 const result = generatePassword(12, {getRandomValues(bytes) { calls++; return bytes.fill(calls === 1 ? 255 : 0); }});
 assert.equal(result, 'a'.repeat(12)); assert.equal(calls, 2);
 assert.throws(() => generatePassword(12, {getRandomValues(bytes) {return bytes.fill(255);}}), /unavailable/);
});
