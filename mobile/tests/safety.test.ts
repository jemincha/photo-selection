import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Request} from '../src/domain.ts';
import {visibleRequests,validateReport} from '../src/safety.ts';
const request:Request={id:'r',ownerId:'a',title:'사진',inviteToken:'token',status:'selecting',selectedIds:[],createdAt:'',members:[{userId:'a',nickname:'나'},{userId:'b',nickname:'친구'}],photos:[],reactions:[],comments:[]};
test('blocks hide peer requests, preserve the owners own photos and never expose nonmember requests',()=>{
 assert.equal(visibleRequests([request],'a',[]).length,1);assert.equal(visibleRequests([request],'stranger',[]).length,0);
 const blocks=[{userId:'a',blockedId:'b'}];assert.equal(visibleRequests([request],'a',blocks).length,1);assert.equal(visibleRequests([request],'b',blocks).length,0);
 assert.equal(visibleRequests([{...request,ownerId:'b'}],'a',blocks).length,0);assert.equal(visibleRequests([{...request,ownerId:'b'}],'b',blocks).length,1);
});
test('retention starts at confirmation; draft dates and 29-day requests remain visible',()=>{
 const now=Date.parse('2026-11-30T12:00:00Z');
 assert.equal(visibleRequests([{...request,createdAt:'2025-01-01'}],'a',[],now).length,1);
 assert.equal(visibleRequests([{...request,confirmedAt:new Date(now-29*86400000).toISOString()}],'a',[],now).length,1);
 assert.equal(visibleRequests([{...request,confirmedAt:new Date(now-30*86400000).toISOString()}],'a',[],now).length,0);
});
test('reports validate allowlisted reasons and bounded details',()=>{
 assert.deepEqual(validateReport('privacy',' 확인 부탁해요 '),{reason:'privacy',details:'확인 부탁해요'});
 assert.throws(()=>validateReport('unknown',''));assert.throws(()=>validateReport('other','x'.repeat(501)));
});
