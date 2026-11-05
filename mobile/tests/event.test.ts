import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventSections,setSectionPhoto} from '../src/event-domain.ts';
import type {Album,Request} from '../src/domain.ts';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as domain from '../src/domain.ts';
import * as safety from '../src/safety.ts';
import {PreviewUrls} from '../src/preview-urls.ts';

function fixture(){
 const members=[{userId:'a',nickname:'A'},{userId:'b',nickname:'B'}],event:Album={id:'trip',title:'여행',createdAt:'',members};
 const request:Request={id:'r',albumId:event.id,title:'A의 사진',createdAt:'',ownerId:'a',inviteToken:'token',status:'selecting',selectedIds:[],members,reactions:[{photoId:'p',userId:'b',value:'like'}],comments:[],photos:[{id:'p',requestId:'r',filename:'B.jpg',mime:'image/jpeg',width:100,height:100,bytes:1,original:'original',thumbnail:'preview'}]};
 return {event,request};
}
test('A uploads B; B can collect into an empty section while retaining source, file and reactions',()=>{
 const {event,request}=fixture();assert.deepEqual(eventSections(event,[request]).map(section=>section.photos.length),[1,0]);
 const added=setSectionPhoto(event,[request],'b','p',true),sections=eventSections(added,[request]);
 assert.deepEqual(sections.map(section=>section.photos.length),[1,1]);assert.equal(sections[1].photos[0].uploadedBy,'a');assert.equal(sections[1].photos[0].brought,true);
 assert.equal(sections[1].photos[0].photo,request.photos[0]);assert.equal(sections[1].photos[0].request.reactions[0].value,'like');assert.equal(event.sectionPhotos,undefined);
 assert.deepEqual(eventSections(JSON.parse(JSON.stringify(added)),[request]).map(section=>section.photos.length),[1,1]);
 const twice=setSectionPhoto(added,[request],'b','p',true);assert.equal(twice.sectionPhotos?.length,1);
 assert.deepEqual(eventSections(setSectionPhoto(twice,[request],'b','p',false),[request]).map(section=>section.photos.length),[1,0]);
 assert.equal(setSectionPhoto(event,[request],'a','p',true).sectionPhotos?.length,0);
});
test('outsiders and cross-event copies fail; removed or inaccessible source photos cannot reappear',()=>{
 const {event,request}=fixture();assert.throws(()=>setSectionPhoto(event,[request],'outsider','p',true));
 assert.throws(()=>setSectionPhoto(event,[{...request,albumId:'other'}],'b','p',true));assert.throws(()=>setSectionPhoto(event,[request],'b','unknown',true));
 const added=setSectionPhoto(event,[request],'b','p',true);assert.deepEqual(eventSections(added,[]).map(section=>section.photos.length),[0,0]);
 assert.deepEqual(eventSections({...added,sectionPhotos:[...added.sectionPhotos!,...added.sectionPhotos!]},[request]).map(section=>section.photos.length),[1,1]);
});

test('local repository persists collection and event names across restart, and rolls back failed creation',async()=>{
 const {event,request}=fixture(),data=new Map([['photo-selection-mvp-v1',JSON.stringify([request])],['photo-selection-albums-v2',JSON.stringify([event])]]);
 let fail=false,sequence=0;
 const storage={getItem:async(key:string)=>data.get(key)||null,multiSet:async(pairs:string[][])=>{if(fail){fail=false;throw new Error('disk full');}for(const [key,value] of pairs)data.set(key,value);}};
 const modules:Record<string,unknown>={
  '@react-native-async-storage/async-storage':storage,'react-native':{Platform:{OS:'web'}},'expo-file-system':{},'expo-image-manipulator':{},
  './backend':{supabase:null},'./id':{randomId:()=>`new-${++sequence}`},'./preview-urls':{PreviewUrls},'./event-domain':{setSectionPhoto},'./domain':domain,'./safety':safety,
  './integrity':{},'./web-photo':{},'./photo-storage':{photoFileUrl:async(reference:string)=>reference},'./upload-error':{},'./device-cleanup':{clearDeviceData:async()=>{}},'./account-deletion':{},
 };
 const exports:any={},source=readFileSync(new URL('../src/repository.ts',import.meta.url),'utf8');
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,console,require:(name:string)=>{if(name in modules)return modules[name];throw new Error(name);}});
 await exports.initialize();await exports.collectEventPhoto(event,'b','p',true);await exports.collectEventPhoto(event,'b','p',true);
 await exports.initialize();let restored=(await exports.listAlbums())[0];assert.equal(restored.sectionPhotos.length,1);
 await exports.renameEvent(restored,'b','제주 여행');await exports.initialize();restored=(await exports.listAlbums())[0];assert.equal(restored.title,'제주 여행');
 assert.equal(eventSections(restored,await exports.listRequests())[1].photos[0].photo.id,'p');
 await exports.collectEventPhoto(restored,'b','p',false);await exports.initialize();assert.equal((await exports.listAlbums())[0].sectionPhotos.length,0);
 const before=data.get('photo-selection-albums-v2');fail=true;await assert.rejects(exports.createEvent('b','B'),/disk full/);assert.equal(data.get('photo-selection-albums-v2'),before);assert.equal((await exports.listAlbums()).length,1);
 const id=await exports.createEvent('b','B'),created=await exports.loadRequest(id);assert.equal(created.simple,undefined);assert.ok(created.albumId);assert.equal((await exports.listAlbums()).length,2);
 await exports.createRequest('b','B의 사진','B',event.id);await exports.collectEventPhoto(event,'b','p',true);await exports.deleteRequest(request,'a');await exports.initialize();
 assert.equal((await exports.listAlbums()).find((album:Album)=>album.id===event.id).sectionPhotos.length,0);assert.equal((await exports.listRequests()).some((r:Request)=>r.id===request.id),false);
});
