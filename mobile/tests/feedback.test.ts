import {test} from 'node:test';
import assert from 'node:assert/strict';
import {photoGroups,selectGroup,assertUploadable,confirm} from '../src/domain.ts';
import type {Request,Photo} from '../src/domain.ts';
import {PreviewUrls} from '../src/preview-urls.ts';
import {resolvePhotoAsset} from '../src/resolve-photo-asset.ts';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';

function fixture():Request{return {id:'r',title:'여행',ownerId:'me',inviteToken:'token',status:'selecting',selectedIds:[],createdAt:'',members:[{userId:'me',nickname:'나'},{userId:'friend',nickname:'친구'}],photos:Array.from({length:100},(_,i)=>({id:String(i),requestId:'r',filename:`${i}.jpg`,mime:'image/jpeg',width:1,height:1,bytes:1,sha256:'hash',original:'file:original',thumbnail:'thumb'})),reactions:[],comments:[]};}
test('100 candidates group by friend without merging conflicting reactions; 20 unique picks keep order across groups',()=>{
 const r=fixture();r.reactions=r.photos.map((p,i)=>({photoId:p.id,userId:'friend',value:i<20?'like':i<50?'unsure':'dislike'}));r.reactions.push({photoId:'0',userId:'me',value:'dislike'},{photoId:'0',userId:'friend',value:'dislike'});
 const groups=photoGroups(r,'friend');assert.deepEqual(groups.map(g=>g.photos.length),[20,30,50,0]);assert.equal(photoGroups(r,'me')[2].photos[0].id,'0');
 const ids=groups[0].photos.map(p=>p.id),selected=selectGroup(selectGroup([],ids,true),ids,true);assert.deepEqual(selected,ids);assert.equal(selected.length,20);
 const confirmed=confirm(r,'me',selected);assert.equal(photoGroups(confirmed,'friend').flatMap(g=>g.photos).length,100);assert.deepEqual(confirmed.selectedIds,ids);
 assert.deepEqual(selectGroup(selected,['0','1'],false),ids.slice(2));assert.throws(()=>assertUploadable(r,'me'),/100/);assertUploadable({...r,photos:r.photos.slice(0,99)},'me');
});
test('preview signing batches uncached paths, joins concurrent loads and renews after four minutes',async()=>{
 let now=0,calls:string[][]=[];const cache=new PreviewUrls(async paths=>{calls.push(paths);await Promise.resolve();return paths.map(path=>({path,url:`signed-${path}-${now}`}))},()=>now);
 assert.deepEqual(await Promise.all([cache.get(['a','b']),cache.get(['b','c'])]),[['signed-a-0','signed-b-0'],['signed-b-0','signed-c-0']]);assert.deepEqual(calls,[['a','b'],['c']]);
 await cache.get(['a','b']);assert.equal(calls.length,2);now=240001;await cache.get(['a','b']);assert.equal(calls.length,3);
});
test('failed or incomplete signing retries and clearing rejects stale in-flight results',async()=>{
 let fail=true;const cache=new PreviewUrls(async paths=>{if(fail)return [];return paths.map(path=>({path,url:path}))});await assert.rejects(cache.get(['a','b']));fail=false;assert.deepEqual(await cache.get(['a','b']),['a','b']);
 let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve});const stale=new PreviewUrls(async paths=>{await wait;return paths.map(path=>({path,url:path}))});const pending=stale.get(['a']);stale.clear();release();await assert.rejects(pending,/변경/);
});
test('existing iPhone asset is reused only after matching the uploaded original',async()=>{
 const photo=fixture().photos[0];let creates=0,verifies=0;
 const ops={read:async(id:string)=>({id,localUri:'file:asset'}),verify:async(_uri:string,_photo:Photo)=>{verifies++},create:async()=>{creates++;return 'new-asset'}};
 assert.equal(await resolvePhotoAsset(photo,'old-asset',ops),'old-asset');assert.equal(creates,0);assert.equal(verifies,1);
 for(const changes of [{read:async()=>{throw new Error('limited permission')}},{read:async(id:string)=>({id,isNetworkAsset:true})},{verify:async()=>{throw new Error('edited')}},{read:async()=>({id:'different',localUri:'file:other'})}])assert.equal(await resolvePhotoAsset(photo,'old-asset',{...ops,...changes}),'new-asset');
 assert.equal(await resolvePhotoAsset({...photo,sha256:undefined},'old-asset',ops),'new-asset');assert.equal(await resolvePhotoAsset(photo,undefined,ops),'new-asset');
 await assert.rejects(resolvePhotoAsset(photo,undefined,{...ops,create:async()=>{throw new Error('download failed')}}),/download failed/);
});
test('native digest adapter preserves binary SHA-256; OS implementation remains a device check',async()=>{
 const source=(await readFile(new URL('../src/integrity.native.ts',import.meta.url),'utf8')).replace("import {CryptoDigestAlgorithm,digest} from 'expo-crypto';", "import {webcrypto} from 'node:crypto';const CryptoDigestAlgorithm={SHA256:'SHA-256'},digest=(algorithm,data)=>webcrypto.subtle.digest(algorithm,data);");
 const native=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
 for(const bytes of [new Uint8Array(),new TextEncoder().encode('설렉'),new Uint8Array([0,128,255,1])])assert.equal(await native.sha256(bytes.buffer),createHash('sha256').update(bytes).digest('hex'));
});
