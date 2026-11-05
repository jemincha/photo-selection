import * as localUsers from '../src/local-users.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventSections,setSectionPhoto,eventArchived,eventKind,friendVotes} from '../src/event-domain.ts';
import type {Album,Request} from '../src/domain.ts';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as domain from '../src/domain.ts';
import * as safety from '../src/safety.ts';
import {PreviewUrls} from '../src/preview-urls.ts';
import * as eventDomain from '../src/event-domain.ts';
import * as feedback from '../src/feedback.ts';
import {reactionSymbols} from '../src/reaction-symbols.ts';

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

test('event labels follow actual uploads; completed and closed events leave the active list',()=>{
 const {event,request}=fixture();
 assert.equal(eventKind(event,[request],'a'),'보낸 요청');assert.equal(eventKind(event,[request],'b'),'받은 요청');
 const borrowed=setSectionPhoto(event,[request],'b','p',true);assert.equal(eventKind(borrowed,[request],'b'),'받은 요청');
 const second={...request,id:'b-upload',ownerId:'b',photos:[{...request.photos[0],id:'bp',requestId:'b-upload'}]};
 for(const user of ['a','b'])assert.equal(eventKind(event,[request,second],user),'함께한 이벤트');
 assert.equal(eventArchived(event,[request]),false);assert.equal(eventArchived(event,[{...request,status:'confirmed'}]),true);
 assert.equal(eventArchived(event,[{...request,status:'confirmed'},second]),false);assert.equal(eventArchived({...event,closedAt:'now'},[request]),true);
 // Server lifecycle includes batches hidden by moderation, so never infer completion from a partial client list.
 assert.equal(eventArchived({...event,completedAt:null},[{...request,status:'confirmed'}]),false);
 assert.equal(eventArchived({...event,completedAt:'now'},[]),true);
});
test('live friend vote groups exclude old self votes and retain mixed vote counts',()=>{
 const {request}=fixture();request.members.push({userId:'c',nickname:'C'});request.reactions=[{photoId:'p',userId:'a',value:'dislike'},{photoId:'p',userId:'b',value:'like'},{photoId:'p',userId:'c',value:'unsure'}];
 assert.deepEqual(friendVotes(request,'p'),{group:'like',counts:{like:1,unsure:1,dislike:0}});
 request.reactions=request.reactions.filter(v=>v.userId==='a');assert.equal(friendVotes(request,'p').group,'unclassified');
 request.reactions=[{photoId:'p',userId:'b',value:'dislike'}];assert.equal(friendVotes(request,'p').group,'dislike');
});

test('event screen shows friend vote groups immediately and opens direct voting without an extra step',()=>{
 const {event,request}=fixture(),store:any={albums:[event],requests:[request],userId:'b',name:'B',friends:[],error:'',loading:false};
 let cursor=0;const states:any[]=[],jsx=(type:unknown,props:any)=>({type,props});
 const modules:Record<string,unknown>={
  'react':{useRef:(initial:unknown)=>({current:initial}),useState:(initial:unknown)=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],(value:unknown)=>{states[i]=value;}];}},
  'react/jsx-runtime':{jsx,jsxs:jsx},'expo-router':{useLocalSearchParams:()=>({id:event.id}),router:{}},
  'react-native':{Modal:'Modal',Pressable:'Pressable',SectionList:'SectionList',Text:'Text',View:'View'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
  './store':{useStore:()=>store,cloudEnabled:false},'./event-domain':eventDomain,'./domain':domain,'./reaction-symbols':{reactionSymbols},'./repository':{},
  './request-share':{RequestShare:'RequestShare'},'./request-actions':{RequestActions:'RequestActions'},'./zoom-photo':{ZoomPhoto:'ZoomPhoto'},
  './ui':{Page:'Page',Button:'Button',Field:'Field',PhotoImage:'PhotoImage',ChoiceButtons:'ChoiceButtons',TaskState:'TaskState',styles:{},useTask:()=>({busy:false,error:''})},
 };
 const exports:any={},source=readFileSync(new URL('../src/event-screen.tsx',import.meta.url),'utf8');
 runInNewContext(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:(name:string)=>{if(name in modules)return modules[name];throw new Error(name);}});
 const render=()=>{cursor=0;const outer=exports.default();return outer.type(outer.props);};
 const walk=(node:any):any[]=>Array.isArray(node)?node.flatMap(walk):node&&typeof node==='object'?[node,...walk(node.props?.children)]:[];
 const labels=(node:any)=>walk(node).filter(n=>n.type==='Button').map(n=>n.props.label);
 let tree=render();assert.deepEqual(labels(tree.props.children[1]),['사진 추가']);
 let list=tree.props.children[0];assert.ok(list.props.sections.some((section:any)=>section.group==='like'&&section.userId==='a'));
 const group=list.props.sections.find((section:any)=>section.group==='like'),header=list.props.renderSectionHeader({section:group}),row=list.props.renderItem({item:group.data[0],section:group});
 const text=(node:any):string=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):typeof node==='string'||typeof node==='number'?String(node):'';
 assert.ok(text(header).includes('♡'));assert.equal(text(header).includes('좋아'),false);assert.ok(text(row).includes('♡'));assert.equal(text(row).includes('좋아'),false);assert.ok(walk(header).some(n=>n.props?.accessibilityLabel?.includes('좋아')));
 assert.equal(labels(list.props.ListHeaderComponent).includes('이벤트 이름 수정'),false);assert.ok(labels(list.props.ListFooterComponent).includes('이벤트 이름 수정'));assert.ok(labels(list.props.ListFooterComponent).includes('함께할 사람 초대'));
 walk(row).find(n=>n.type==='Pressable').props.onPress();tree=render();assert.ok(walk(tree).some(n=>n.type==='ChoiceButtons'));assert.equal(labels(tree).includes('이 사진 골라보기'),false);
 store.userId='a';tree=render();assert.equal(walk(tree).some(n=>n.type==='ChoiceButtons'),false);assert.deepEqual(labels(tree.props.children[1]),['사진 추가','최종 선택']);
 store.userId='b';store.requests.push({...request,id:'b-upload',ownerId:'b',photos:[{...request.photos[0],id:'bp',requestId:'b-upload'}]});tree=render();assert.deepEqual(labels(tree.props.children[1]),['사진 추가','최종 선택']);
 store.albums=[{...event,closedAt:'now'}];tree=render();assert.deepEqual(labels(tree.props.children[1]),['선택 결과']);
});

test('local repository persists collection and event names across restart, and rolls back failed creation',async()=>{
 const {event,request}=fixture(),data=new Map([['photo-selection-mvp-v1',JSON.stringify([request])],['photo-selection-albums-v2',JSON.stringify([event])]]);
 let fail=false,sequence=0,cleanupFail=false;const cleaned:string[]=[];
 const storage={setItem:async(key:string,value:string)=>{data.set(key,value);},removeItem:async(key:string)=>{data.delete(key);},getAllKeys:async()=>Array.from(data.keys()),multiRemove:async(keys:string[])=>{keys.forEach(key=>data.delete(key));},getItem:async(key:string)=>data.get(key)||null,multiSet:async(pairs:string[][])=>{if(fail){fail=false;throw new Error('disk full');}for(const [key,value] of pairs)data.set(key,value);}};
 const modules:Record<string,unknown>={
  '@react-native-async-storage/async-storage':storage,'react-native':{Platform:{OS:'web'}},'expo-file-system':{},'expo-image-manipulator':{},
  './local-users':localUsers,'./feedback':feedback,'./backend':{supabase:null},'./id':{randomId:()=>`new-${++sequence}`},'./preview-urls':{PreviewUrls},'./event-domain':{setSectionPhoto,eventArchived},'./domain':domain,'./safety':safety,
  './integrity':{},'./web-photo':{},'./photo-storage':{photoFileUrl:async(reference:string)=>reference},'./upload-error':{},'./device-cleanup':{clearDeviceData:async(id:string)=>{if(cleanupFail){cleanupFail=false;throw new Error('cleanup failed');}cleaned.push(id);}},'./account-deletion':{},
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
 // Connections survive event/photo deletion and are persisted for later invitations.
 assert.ok((await exports.listFriends('b')).some((friend:{userId:string})=>friend.userId==='a'));
 const saved=JSON.parse(data.get('photo-selection-mvp-v1')!);saved.find((r:Request)=>r.id===id).photos=[{...request.photos[0],id:'new-photo',requestId:id}];data.set('photo-selection-mvp-v1',JSON.stringify(saved));await exports.initialize();
 const newEvent=(await exports.listAlbums()).find((a:Album)=>a.id===created.albumId);
 await assert.rejects(exports.inviteFriend(newEvent,'b','stranger'),/연결된 친구/);
 await exports.inviteFriend(newEvent,'b','a');await exports.inviteFriend(newEvent,'b','a');await exports.initialize();
 let inbox=await exports.listEventInvites('a');assert.equal(inbox.length,1);await assert.rejects(exports.respondEventInvite(inbox[0].id,'b','B',true));
 await exports.respondEventInvite(inbox[0].id,'a','A',true);assert.equal((await exports.listEventInvites('a')).length,0);
 assert.ok((await exports.listAlbums()).find((a:Album)=>a.id===created.albumId).members.some((m:{userId:string})=>m.userId==='a'));
 await assert.rejects(exports.react(await exports.loadRequest(id),'b','new-photo','like'),/내 사진/);
 await exports.react(await exports.loadRequest(id),'a','new-photo','unsure');
 await assert.rejects(exports.closeEvent(newEvent,'a'),/만든 사람/);await exports.closeEvent(newEvent,'b');await exports.initialize();
 assert.ok((await exports.listAlbums()).find((a:Album)=>a.id===created.albumId).closedAt);
 await assert.rejects(exports.react(await exports.loadRequest(id),'a','new-photo','like'),/마감/);
 await assert.rejects(exports.createRequest('a','새 사진','A',created.albumId),/마감/);
 // A failed device cleanup retains a resumable plan and cannot erase identity or friends.
 const peerId=await exports.createEvent('a','A');const peerData=JSON.parse(data.get('photo-selection-mvp-v1')!);peerData.find((r:Request)=>r.id===peerId).photos=[{...request.photos[0],id:'peer-photo',requestId:peerId}];data.set('photo-selection-mvp-v1',JSON.stringify(peerData));await exports.initialize();
 data.set('photo-selection-nickname','B');data.set('sb-auth-token','session');
 const beforeCleanup=cleaned.length;cleanupFail=true;
 await assert.rejects(exports.clearEventHistory('b'),/cleanup failed/);
 assert.equal(JSON.parse(data.get('seollek-history-reset:b')!).accepted,true);
 await exports.initialize();await exports.clearEventHistory('b');await exports.initialize();
 assert.equal(data.has('seollek-history-reset:b'),false);assert.ok(cleaned.length>beforeCleanup);
 assert.equal(data.get('photo-selection-nickname'),'B');assert.equal(data.get('sb-auth-token'),'session');
 assert.ok((await exports.listFriends('b')).some((friend:{userId:string})=>friend.userId==='a'));
 assert.equal((await exports.listRequests()).some((r:Request)=>r.ownerId==='b'),false);assert.equal((await exports.loadRequest(peerId)).photos[0].id,'peer-photo');assert.equal(cleaned.slice(beforeCleanup).includes(peerId),false);
 assert.equal((await exports.submitFeedback('b','bug','  화면이 멈춰요  ')).delivered,false);
 assert.equal(JSON.parse(data.get('seollek-feedback-draft:b')!).body,'화면이 멈춰요');

 // Both local users can upload, vote on the peer's photos, and confirm their own picks.
 data.set('photo-selection-nickname','제민');data.set('photo-selection-friend-nickname','테스트 친구');
 const aId=await exports.createEvent('local-me','철수');let both=JSON.parse(data.get('photo-selection-mvp-v1')!);
 both.find((r:Request)=>r.id===aId).photos=[{...request.photos[0],id:'a-photo',requestId:aId}];data.set('photo-selection-mvp-v1',JSON.stringify(both));await exports.initialize();
 let a=await exports.loadRequest(aId);await exports.prepareLocalUser(a,'local-friend','영희');
 const bId=await exports.createRequest('local-friend','영희의 사진','영희',a.albumId);both=JSON.parse(data.get('photo-selection-mvp-v1')!);
 both.find((r:Request)=>r.id===bId).photos=[{...request.photos[0],id:'b-photo',requestId:bId}];data.set('photo-selection-mvp-v1',JSON.stringify(both));await exports.initialize();
 a=await exports.loadRequest(aId);const b=await exports.loadRequest(bId);
 assert.deepEqual(Array.from(a.members,(m:any)=>m.nickname),['철수','영희']);
 await exports.react(a,'local-friend','a-photo','like');await exports.react(b,'local-me','b-photo','like');
 await assert.rejects(exports.react(a,'local-me','a-photo','like'),/내 사진/);await assert.rejects(exports.react(b,'local-friend','b-photo','like'),/내 사진/);
 await exports.finalize(await exports.loadRequest(aId),'local-me',['a-photo']);await exports.finalize(await exports.loadRequest(bId),'local-friend',['b-photo']);
 assert.equal((await exports.loadRequest(aId)).status,'confirmed');assert.equal((await exports.loadRequest(bId)).status,'confirmed');

});
