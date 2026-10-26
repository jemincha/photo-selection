import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deleteAccountData} from '../src/account-deletion.ts';
test('no local/session deletion happens before the server accepts deletion',async()=>{
 const calls:string[]=[];
 await assert.rejects(()=>deleteAccountData({queued:async()=>false,markRequested:async()=>{calls.push('requested')},begin:async()=>{throw Error('offline')},markQueued:async()=>{calls.push('queued')},cleanDevice:async()=>{calls.push('device')},signOut:async()=>{calls.push('signout')},receipt:async()=>{calls.push('receipt')}}));
 assert.deepEqual(calls,['requested']);
});
test('restart after failed device cleanup reuses the accepted job without needing the deleted Auth user',async()=>{
 let queued=false,failed=true;const calls:string[]=[];
 const steps={queued:async()=>queued,markRequested:async()=>{calls.push('requested')},begin:async()=>{calls.push('begin')},markQueued:async()=>{queued=true;calls.push('queued')},cleanDevice:async()=>{calls.push('device');if(failed){failed=false;throw Error('disk')}},signOut:async()=>{calls.push('signout')},receipt:async()=>{calls.push('receipt')}};
 await assert.rejects(()=>deleteAccountData(steps));await deleteAccountData(steps);
 assert.deepEqual(calls,['requested','begin','queued','device','device','signout','receipt']);
});
