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


test('native import copies and uploads one photo at a time; a copy failure does not stop the next photo',async()=>{
 const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm'),{default:ts}=await import('typescript');
 for(const failFirst of [false,true]){
  const data=new Map<string,string>(),files=new Set<string>(),calls:string[]=[],effects:(()=>void)[]=[],jobs:Promise<unknown>[]=[];let count=0;
  const jsx=(type:unknown,props:any)=>({type,props});
  const storage={getItem:async(key:string)=>data.get(key)||null,setItem:async(key:string,value:string)=>{data.set(key,value);}};
  class File{uri:string;name:string;constructor(...parts:any[]){this.uri=parts.map(part=>typeof part==='string'?part:part.uri).join('');this.name=this.uri.split('/').pop()!;}get exists(){return files.has(this.uri);}copy(target:File){calls.push(`copy:${this.uri}`);if(failFirst&&this.uri==='file://a')throw new Error('disk full');files.add(target.uri);}delete(){files.delete(this.uri);}}
  const request={id:'r',albumId:'event',photos:[]},store={userId:'local-me',refresh:async()=>{}};
  const modules:Record<string,unknown>={
   'react':{useRef:(value:unknown)=>({current:value}),useState:(value:unknown)=>[value,()=>{}],useEffect:(fn:()=>void)=>effects.push(fn)},'expo-router':{},'react-native':{Image:'Image',Text:'Text',View:'View'},'expo-image-picker':{},'@react-native-async-storage/async-storage':storage,'expo-file-system':{File,Paths:{document:{uri:'document/'}}},
   './pending-photos':{pendingPhotos:{get:()=>({native:[asset('a'),asset('b')]}),delete:()=>{}}},'./request-share':{},'./request-actions':{},'./native-upload-state':{mergeNativeSelection,restoreNativeItems},'./id':{randomId:()=>`p${++count}`},'./request-hook':{useRequest:()=>({id:'r',store,request,owner:true,locked:false})},
   './repository':{loadRequest:async()=>request,upload:async(_r:unknown,_uid:string,_asset:unknown,id:string)=>{calls.push(`upload:${id}`);return {id};}},'./ui':{Page:'Page',Button:'Button',styles:{},TaskState:'TaskState',useTask:()=>({busy:false,error:'',run:(fn:()=>Promise<void>)=>{const job=fn();jobs.push(job);return job;}})},
  };
  const exports:any={},source=readFileSync(new URL('../src/upload-screen.tsx',import.meta.url),'utf8');
  runInNewContext(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,{exports,setTimeout,require:(name:string)=>{if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};if(name in modules)return modules[name];throw new Error(name);}});
  exports.default();effects.forEach(fn=>fn());await Promise.all(jobs);
  assert.deepEqual(calls,failFirst?['copy:file://a','copy:file://b','upload:p2']:['copy:file://a','upload:p1','copy:file://b','upload:p2']);
  const saved=JSON.parse(data.get('seollek-native-upload:local-me:r')!);assert.equal(saved[0].status,failFirst?'failed':'done');assert.equal(saved[1].status,'done');
 }
});
