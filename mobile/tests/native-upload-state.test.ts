import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeNativeSelection,restoreNativeItems} from '../src/native-upload-state.ts';
import type {NativeUploadItem} from '../src/native-upload-state.ts';
function asset(id:string){return {uri:`file://${id}`,assetId:id,width:10,height:10,fileName:`${id}.jpg`,fileSize:50,mimeType:'image/jpeg'};}
test('native reselection preserves failed IDs, order and completed files',()=>{const items:NativeUploadItem[]=[{id:'saved',asset:asset('a'),status:'done'},{id:'pending',asset:asset('b'),status:'failed'}];const result=mergeNativeSelection(items,[asset('a'),{...asset('b'),uri:'file://fresh'}],()=>{throw Error('Must reuse IDs')});assert.equal(result[0],items[0]);assert.equal(result[1].id,'pending');assert.equal(result[1].asset.uri,'file://fresh');assert.equal(result[1].status,'waiting');assert.equal(items[1].status,'failed');});
test('unrelated native files cannot replace an unfinished item',()=>{const items:NativeUploadItem[]=[{id:'pending',asset:asset('b'),status:'failed'}];assert.throws(()=>mergeNativeSelection(items,[asset('x')],()=>''));const anonymous={...asset('b'),assetId:null,fileSize:undefined};assert.throws(()=>mergeNativeSelection([{...items[0],asset:anonymous}],[anonymous],()=>''));});
test('invalid native manifests stop recovery; interrupted items keep their IDs',()=>{
 for(const raw of ['{}','null','[{}]','bad json'])assert.throws(()=>restoreNativeItems(raw));
 const items=restoreNativeItems(JSON.stringify([{id:'saved',asset:asset('a'),status:'done'},{id:'pending',asset:asset('b'),status:'processing'}]));
 assert.equal(items[0].status,'done');assert.equal(items[1].status,'failed');assert.equal(items[1].id,'pending');
});
