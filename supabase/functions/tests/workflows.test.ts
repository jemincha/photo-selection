import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanupJob,moderateContent,removeTree,maintenanceAuthorized} from '../_shared/workflows.ts';
test('maintenance rejects missing or weak secrets and user tokens; only its server credential passes',()=>{
 assert.equal(maintenanceAuthorized(undefined,''),false);assert.equal(maintenanceAuthorized('short','Bearer short'),false);
 const secret='test-only-'.repeat(5);assert.equal(maintenanceAuthorized(secret,'Bearer user-jwt'),false);assert.equal(maintenanceAuthorized(secret,`Bearer ${secret}`),true);
});
test('safety is fail-closed on missing keys, errors, malformed or flagged responses',async()=>{
 const response=(body:unknown,status=200)=>async()=>Response.json(body,{status});
 await assert.rejects(()=>moderateContent('사진',['private-url'],'',response({})),/configured/);
 await assert.rejects(()=>moderateContent('사진',['private-url'],'test',response({},503)),/unavailable/);
 for(const body of [{},{results:[]},{results:[{}]}])await assert.rejects(()=>moderateContent('사진',['private-url'],'test',response(body)),/Invalid/);
 assert.equal(await moderateContent('사진',['private-url'],'test',response({results:[{flagged:true}]})),false);
 assert.equal(await moderateContent('사진',['private-url'],'test',response({results:[{flagged:false}]})),true);
});
test('every preview and the title are checked before a group is approved',async()=>{
 const seen:string[]=[];let calls=0;
 const send:typeof fetch=async(_url,options)=>{const body=JSON.parse(String(options?.body));assert.equal(body.input[0].text,'제목');seen.push(...body.input.slice(1).map((v:{image_url:{url:string}})=>v.image_url.url));calls++;return Response.json({results:[{flagged:false}]});};
 const urls=Array.from({length:13},(_,i)=>`server-selected-${i}`);
 assert.equal(await moderateContent('제목',urls,'test',send),true);assert.deepEqual(seen,urls);assert.equal(calls,3);
});
test('storage failures preserve data/job and Auth failures preserve the resumable job',async()=>{
 for(const failure of ['files','data','auth']){
  const calls:string[]=[];const step=async(name:string)=>{calls.push(name);if(name===failure)throw new Error(name)};
  await assert.rejects(()=>cleanupJob({id:'me',kind:'account'},{requestIds:async()=>['request'],removeFiles:()=>step('files'),finishData:()=>step('data'),deleteAuth:()=>step('auth'),complete:()=>step('complete')}));
  assert.ok(!calls.includes('complete'));if(failure==='files')assert.deepEqual(calls,['files']);
 }
});
test('cleanup deletes files then data then Auth; request deletion never deletes Auth',async()=>{
 for(const kind of ['account','request'] as const){const calls:string[]=[];await cleanupJob({id:'me',kind},{requestIds:async()=>['one','two'],removeFiles:async id=>{calls.push(id)},finishData:async()=>{calls.push('data')},deleteAuth:async()=>{calls.push('auth')},complete:async()=>{calls.push('complete')}});assert.deepEqual(calls,['one','two','data',...(kind==='account'?['auth']:[]),'complete']);}
});
test('recursive storage cleanup re-lists offset zero so pages are never skipped',async()=>{
 const remaining=new Set(Array.from({length:205},(_,i)=>`r/original/p/${i}.jpg`));
 await removeTree('r',{
  list:async prefix=>{const children=new Map<string,{name:string;file:boolean}>();for(const name of remaining){if(!name.startsWith(`${prefix}/`))continue;const tail=name.slice(prefix.length+1),child=tail.split('/')[0];children.set(child,{name:child,file:!tail.includes('/')});}return [...children.values()].slice(0,100)},
  remove:async paths=>{for(const path of paths)remaining.delete(path)},
 });assert.equal(remaining.size,0);
});
