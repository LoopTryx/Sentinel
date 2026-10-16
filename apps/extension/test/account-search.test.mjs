import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesAccount } from '../src/account-search.js';
test('account search matches names, usernames and origins without searching secrets',()=>{
 const account={name:'Orbit Mail',user:'alex@example.test',host:'mail.example.test',password:'private-secret'};
 assert.equal(matchesAccount(account,' ORBIT '),true);
 assert.equal(matchesAccount(account,'alex@'),true);
 assert.equal(matchesAccount(account,'mail.example'),true);
 assert.equal(matchesAccount(account,'private-secret'),false);
 assert.equal(matchesAccount(account,''),true);
});
