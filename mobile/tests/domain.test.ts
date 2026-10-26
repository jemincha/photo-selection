import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setChoice,confirm,addComment,choiceFor,submitSelection,albumCover,selectionSummary,assertUploadable,publishRequest,requestDestination,submittedLikes} from '../src/domain.ts';
import type {Request} from '../src/domain.ts';
function fixture():Request{return {id:'request',ownerId:'a',title:'여행',inviteToken:'token',status:'selecting',selectedIds:[],createdAt:'',members:[{userId:'a',nickname:'A'},{userId:'b',nickname:'B'}],photos:[{id:'p',requestId:'request',filename:'p.jpg',mime:'image/jpeg',width:100,height:100,bytes:50,original:'original',thumbnail:'thumbnail'}],reactions:[],comments:[]};}

test('simple requests freeze uploads on publication, legacy requests remain editable',()=>{const draft={...fixture(),simple:true};assertUploadable(draft,'a');const published=publishRequest(draft,'a',' ');assert.equal(published.title,'어떤 사진이 제일 좋아?');assert.ok(published.publishedAt);assert.throws(()=>assertUploadable(published,'a'));assertUploadable({...published,simple:false},'a');assert.throws(()=>publishRequest({...draft,photos:[]},'a','제목'));assert.throws(()=>publishRequest(draft,'b','제목'));assert.equal(publishRequest(published,'a','다른 제목'),published);});
test('request destinations match roles and completed submissions count separately from draft reactions',()=>{let r:Request={...fixture(),simple:true};assert.equal(requestDestination(r,'a'),'/requests/request/upload');r=publishRequest(r,'a','제목');assert.equal(requestDestination(r,'a'),'/requests/request/result');assert.equal(requestDestination(r,'b'),'/requests/request/photo?photoId=p');r=setChoice(r,'b','p','like');assert.equal(submittedLikes(r,'p'),0);r=submitSelection(r,'b');assert.equal(submittedLikes(r,'p'),1);assert.equal(requestDestination(confirm(r,'a',['p']),'b'),'/requests/request/result');});
test('three classifications are exclusive, uncertainty differs from unclassified, and votes stay per user',()=>{let r=fixture();r=setChoice(r,'b','p','unsure');assert.equal(choiceFor(r,'b','p'),'unsure');r=setChoice(r,'b','p','like');r=setChoice(r,'a','p','dislike');assert.equal(r.reactions.length,2);assert.equal(choiceFor(r,'b','p'),'like');r=setChoice(r,'b','p',null);assert.equal(choiceFor(r,'b','p'),null);assert.equal(choiceFor(r,'a','p'),'dislike');});
test('friends cannot confirm, outsiders cannot react, unknown photos cannot be selected',()=>{const r=fixture();assert.throws(()=>confirm(r,'b',['p']));assert.throws(()=>setChoice(r,'outsider','p','like'));assert.throws(()=>confirm(r,'a',['unknown']));assert.throws(()=>confirm(r,'a',[]));assert.throws(()=>confirm(r,'a',['p','p']));});
test('confirmation freezes classifications and comments including owner edits',()=>{const r=confirm(fixture(),'a',['p']);assert.throws(()=>setChoice(r,'b','p','like'));assert.throws(()=>setChoice(r,'a','p','unsure'));assert.throws(()=>addComment(r,'b',null,'좋아','c'));assert.throws(()=>confirm(r,'a',['p']));});
test('photo comments cannot reference another request and all text is validated',()=>{const r=fixture();assert.throws(()=>addComment(r,'b','other','좋아','c'));assert.throws(()=>addComment(r,'b',null,' ','c'));assert.equal(addComment(r,'b',null,' 사진 p 먼저! ','c').comments[0].body,'사진 p 먼저!');});
test('one identity can own one request and help another without leaking selections',()=>{const own=fixture();const friends={...fixture(),id:'other',ownerId:'b'};const changed=setChoice(friends,'a','p','unsure');assert.equal(choiceFor(own,'a','p'),null);assert.equal(choiceFor(changed,'a','p'),'unsure');assert.equal(confirm(own,'a',['p']).status,'confirmed');assert.throws(()=>confirm(friends,'a',['p']));});

test('submission requires all classifications, snapshots likes, and editing invalidates only the editor',()=>{let r=fixture();assert.throws(()=>submitSelection(r,'b'));r=setChoice(r,'b','p','like');r=submitSelection(r,'b');assert.deepEqual(r.submissions?.[0].selectedIds,['p']);r=setChoice(r,'a','p','unsure');r=submitSelection(r,'a');assert.deepEqual(r.submissions?.find(s=>s.userId==='a')?.selectedIds,[]);r=setChoice(r,'b','p','dislike');assert.equal(r.submissions?.length,1);assert.equal(r.submissions?.[0].userId,'a');assert.throws(()=>submitSelection(r,'outsider'));assert.throws(()=>submitSelection({...r,photos:[]},'a'));assert.throws(()=>submitSelection(confirm(r,'a',['p']),'b'));});

test('album covers match the previous photo order and skip empty or unselected requests',()=>{
 const request=fixture(),first=request.photos[0],second={...first,id:'second'};
 const empty={...request,photos:[]},confirmed:Request={...request,status:'confirmed',photos:[first,second],selectedIds:['second','p']};
 for(const requests of [[],[empty],[{...confirmed,selectedIds:[]}],[empty,confirmed,request],[{...confirmed,selectedIds:['second']},request],[request,confirmed]]){
  const previous=requests.flatMap(r=>r.status==='confirmed'?r.photos.filter(p=>r.selectedIds.includes(p.id)):r.photos)[0];
  assert.equal(albumCover(requests),previous);
 }
 const later={...request,get photos():Request['photos']{throw new Error('A found cover must stop photo traversal')}};
 assert.equal(albumCover([request,later]),first);
});

test('selection summaries match per-photo lookup, preserve order and isolate users',()=>{
 const request=fixture();
 request.photos=['third','first','second','unclassified'].map(id=>({...request.photos[0],id}));
 request.reactions=[
  {userId:'a',photoId:'third',value:'like'},
  {userId:'b',photoId:'first',value:'like'},
  {userId:'a',photoId:'first',value:'unsure'},
  {userId:'a',photoId:'second',value:'dislike'},
  {userId:'a',photoId:'third',value:'dislike'},
  {userId:'a',photoId:'missing',value:'like'},
 ];
 for(const data of [request,{...request,photos:[]},{...request,reactions:[]}]){
  for(const userId of ['a','b','outsider']){
   const summary=selectionSummary(data,userId);
   assert.deepEqual(summary.remaining,data.photos.filter(p=>!choiceFor(data,userId,p.id)));
   assert.deepEqual(summary.liked,data.photos.filter(p=>choiceFor(data,userId,p.id)==='like'));
   for(const value of ['like','unsure','dislike'] as const)assert.equal(summary.counts[value],data.photos.filter(p=>choiceFor(data,userId,p.id)===value).length);
  }
 }
});
