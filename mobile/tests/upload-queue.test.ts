import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {UploadQueue} from '../src/upload-queue.ts';
import type {UploadItem} from '../src/upload-queue.ts';
import {queueStorage,removeUploadSessions} from '../src/upload-queue-storage.ts';
import {thumbnailSize} from '../src/web-photo.ts';
const item=(id:string):UploadItem=>({id,filename:`${id}.jpg`,mime:'image/jpeg',bytes:8,file:new Blob([id.padEnd(8,'x')],{type:'image/jpeg'}),status:'waiting',durations:{}});
test('deleting one request clears every participant queue without touching another request',async()=>{
 for(const scope of ['a:delete','b:delete','a:keep']){const storage=queueStorage(scope),photo=item(scope);await storage.manifest([photo]);await storage.attach(photo);}
 await removeUploadSessions('delete');
 assert.equal((await queueStorage('a:delete').load()).length,0);assert.equal((await queueStorage('b:delete').load()).length,0);assert.equal((await queueStorage('a:keep').load()).length,1);
});

test('a new page restores all 20 persisted files, IDs and order; processing is serial',async()=>{
 const storage=queueStorage('restore-20'),items=Array.from({length:20},(_,i)=>item(`photo-${i}`));
 await storage.manifest(items);for(const photo of items)await storage.attach(photo);
 // A registered item can precede a browser restart. Its payload is no longer needed.
 await storage.result({...items[0],status:'done',file:undefined,stored:true});
 const recovered=new UploadQueue(storage);await recovered.load();assert.equal(recovered.getSnapshot().restored,true);assert.equal(recovered.getSnapshot().items.length,20);
 assert.deepEqual(recovered.getSnapshot().items.map(item=>item.id),items.map(item=>item.id));
 let active=0,peak=0;const processed:string[]=[];
 await recovered.resume(async(photo,onStage)=>{active++;peak=Math.max(peak,active);onStage('hash');assert.equal(await photo.file!.text(),photo.id.padEnd(8,'x'));await new Promise(resolve=>setTimeout(resolve,2));processed.push(photo.id);active--});
 assert.equal(peak,1);assert.deepEqual(processed,items.slice(1).map(item=>item.id));assert.ok(recovered.getSnapshot().items.every(item=>item.status==='done'));
 const afterReload=new UploadQueue(storage);await afterReload.load();assert.ok(afterReload.getSnapshot().items.every(item=>item.status==='done'&&!item.file));
 await afterReload.resume(async()=>{throw new Error('Completed files must not upload again')});assert.equal(afterReload.getSnapshot().error,'');
});
test('interruption during initial file staging preserves names; reselection keeps IDs and skips completed photos',async()=>{
 const storage=queueStorage('staging-interruption'),items=[item('first'),item('second')];await storage.manifest(items);await storage.attach(items[0]);await storage.result({...items[0],status:'done',file:undefined,stored:true});
 const restored=new UploadQueue(storage);await restored.load();assert.equal(restored.getSnapshot().items[1].status,'failed');assert.equal(restored.getSnapshot().items[1].filename,'second.jpg');
 const selected=[{...item('first'),id:'new-first'},{...item('second'),id:'new-second'}],uploaded:string[]=[];
 await restored.add(selected,async photo=>{uploaded.push(photo.id)});assert.deepEqual(uploaded,['second']);assert.deepEqual(restored.getSnapshot().items.map(item=>item.id),['first','second']);
});
test('a failed item alone retries, and rapid resume calls cannot start two upload loops',async()=>{
 const queue=new UploadQueue(queueStorage('retry')),attempts:string[]=[];let fail=true;
 const upload=async(photo:UploadItem)=>{attempts.push(photo.id);await new Promise(resolve=>setTimeout(resolve,3));if(photo.id==='retry'&&fail){fail=false;throw new Error('Network interrupted')}};
 await queue.add([item('success'),item('retry')],upload);assert.equal(queue.getSnapshot().items[1].status,'failed');
 await Promise.all([queue.resume(upload),queue.resume(upload)]);assert.deepEqual(attempts,['success','retry','retry']);assert.ok(queue.getSnapshot().items.every(item=>item.status==='done'));
});
test('a queue write failure never turns an unpersisted original into a completed photo',async()=>{
 const storage=queueStorage('quota'),queue=new UploadQueue({...storage,attach:async()=>{throw new Error('QuotaExceededError')}});let uploads=0;
 await queue.add([item('too-large')],async()=>{uploads++});assert.equal(uploads,0);assert.equal(queue.getSnapshot().items[0].status,'failed');
 const restored=new UploadQueue(storage);await restored.load();assert.equal(restored.getSnapshot().items.length,1);assert.equal(restored.getSnapshot().items[0].filename,'too-large.jpg');
});
test('thumbnail dimensions bound both portrait and landscape images and do not upscale',()=>{
 assert.deepEqual(thumbnailSize(4032,3024),{width:720,height:540});assert.deepEqual(thumbnailSize(3024,4032),{width:540,height:720});assert.deepEqual(thumbnailSize(200,100),{width:200,height:100});
});

test('add and resume release the busy flag after a manifest failure and allow retry',async()=>{
 for(const operation of ['add','resume'] as const){
  const storage=queueStorage(`manifest-failure-${operation}`),photo=item(operation);
  if(operation==='resume'){await storage.manifest([photo]);await storage.attach(photo)}
  let fail=true,uploads=0;
  const queue=new UploadQueue({...storage,manifest:async items=>{if(fail)throw new Error('Storage unavailable');await storage.manifest(items)}});
  const transport=async()=>{uploads++};
  if(operation==='add')await queue.add([photo],transport);else await queue.resume(transport);
  assert.equal(queue.getSnapshot().busy,false);assert.equal(queue.getSnapshot().error,'Storage unavailable');assert.equal(uploads,0);
  assert.equal(queue.getSnapshot().items[0].id,photo.id);
  fail=false;await queue.resume(transport);
  assert.equal(queue.getSnapshot().busy,false);assert.equal(queue.getSnapshot().error,'');assert.equal(uploads,1);
  assert.equal(queue.getSnapshot().items[0].status,'done');
 }
});

test('concurrent add and resume keep the active batch and upload each file once',async()=>{
 const queue=new UploadQueue(queueStorage('concurrent-add-resume')),uploaded:string[]=[];
 const transport=async(photo:UploadItem)=>{uploaded.push(photo.id);await new Promise(resolve=>setTimeout(resolve,2))};
 await Promise.all([queue.add([item('active')],transport),queue.add([item('ignored')],transport),queue.resume(transport)]);
 assert.deepEqual(uploaded,['active']);assert.deepEqual(queue.getSnapshot().items.map(photo=>photo.id),['active']);
 assert.equal(queue.getSnapshot().busy,false);assert.equal(queue.getSnapshot().items[0].status,'done');
});
