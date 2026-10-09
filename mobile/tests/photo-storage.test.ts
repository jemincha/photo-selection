import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storePhotoFiles,photoFileUrl} from '../src/photo-storage.ts';
import {uploadError} from '../src/upload-error.ts';
test('large originals are stored as exact binary files and metadata remains small',async()=>{
 const bytes=Uint8Array.from({length:8*1024*1024},(_,i)=>i%251);
 const saved=await storePhotoFiles('large',new Blob([bytes],{type:'image/jpeg'}),new Blob(['preview'],{type:'image/jpeg'}));
 const restored=JSON.parse(JSON.stringify(saved));
 assert.ok(JSON.stringify(restored).length<150);
 assert.deepEqual(new Uint8Array(await (await fetch(await photoFileUrl(restored.original))).arrayBuffer()),bytes);
 assert.equal(await (await fetch(await photoFileUrl(restored.thumbnail))).text(),'preview');
});
test('legacy images stay readable and missing binary files produce a clear error',async()=>{const legacy='data:image/png;base64,AAAA';assert.equal(await photoFileUrl(legacy),legacy);await assert.rejects(()=>photoFileUrl('photo-file:missing:original'),/찾을 수/);});
test('upload failures identify storage quota separately from HEIC preview failures',()=>{assert.match(uploadError('store',new DOMException('Storage quota exceeded','QuotaExceededError')).message,/저장 공간/);assert.match(uploadError('preview',new Error('decode failed'),'image/heic').message,/HEIC/);assert.match(uploadError('read',new Error('empty')).message,/파일 읽기/);});
