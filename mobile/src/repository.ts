import {localUsers,localProfile} from './local-users';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {randomId} from './id';
import {PreviewUrls} from './preview-urls';
import { File,Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { manipulateAsync,SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import {supabase,checked} from './backend';
import {sha256,sha256Blob} from './integrity';
import {createWebThumbnail,thumbnailSize} from './web-photo';
import {storePhotoFiles,photoFileUrl} from './photo-storage';
import {uploadError,UploadStage} from './upload-error';
import {Album,Request,Photo,Choice,Member,EventInvite,submitSelection,assertOpen,assertOwner,assertVoter,assertUploadable,publishRequest,setChoice,confirm,addComment} from './domain';
import {visibleRequests,validateReport} from './safety';
import type {Block,ReportReason} from './safety';
import {clearDeviceData} from './device-cleanup';
import {deleteAccountData} from './account-deletion';
import {setSectionPhoto,eventArchived} from './event-domain';
import {feedbackInput} from './feedback';
import type {FeedbackKind} from './feedback';
const key='photo-selection-mvp-v1';
let local:Request[]=[];
let albums:Album[]=[];
let connections:{userId:string;friendId:string;nickname:string}[]=[];
let invitations:EventInvite[]=[];
function rememberFriends(album:Album){for(const person of album.members)for(const friend of album.members)if(person.userId!==friend.userId){connections=connections.filter(c=>c.userId!==person.userId||c.friendId!==friend.userId);connections.push({userId:person.userId,friendId:friend.userId,nickname:friend.nickname});}}
function syncEvents(){albums=albums.map(album=>{const batches=local.filter(r=>r.albumId===album.id),done=batches.length>0&&batches.every(r=>r.photos.length>0&&r.status==='confirmed');return {...album,ownerId:album.ownerId||[...batches].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))[0]?.ownerId,completedAt:done?(album.completedAt||new Date().toISOString()):null};});}
function assertEventOpen(albumId:string|undefined){const album=albums.find(a=>a.id===albumId);if(album&&eventArchived(album,local))throw new Error('마감된 이벤트는 변경할 수 없어요.');}
let blocks:Block[]=[];
let reports:{requestId:string;photoId:string|null;targetId:string|null;reason:ReportReason;details:string;createdAt:string}[]=[];
const albumKey='photo-selection-albums-v2';
let localWrites=Promise.resolve();
const thumbnailUrls=new PreviewUrls(async paths=>checked(await supabase!.storage.from('request-photos').createSignedUrls(paths,300)).map(row=>({path:row.path||'',url:row.signedUrl||''})));
async function persist(){syncEvents();const snapshot=JSON.stringify(local),albumSnapshot=JSON.stringify(albums),safety=JSON.stringify({blocks,reports}),socialSnapshot=JSON.stringify({connections,invitations});localWrites=localWrites.catch(()=>{}).then(()=>AsyncStorage.multiSet([[key,snapshot],[albumKey,albumSnapshot],['seollek-safety',safety],['seollek-social',socialSnapshot]]));await localWrites;}
export async function initialize(){if(!supabase){local=JSON.parse(await AsyncStorage.getItem(key)||'[]');albums=JSON.parse(await AsyncStorage.getItem(albumKey)||'[]');const safety=JSON.parse(await AsyncStorage.getItem('seollek-safety')||'{}');blocks=safety.blocks||[];reports=safety.reports||[];const social=JSON.parse(await AsyncStorage.getItem('seollek-social')||'{}');connections=social.connections||[];invitations=social.invitations||[];for(const r of local){if(!r.albumId){r.albumId=r.id;albums.push({id:r.id,title:r.title,createdAt:r.createdAt,members:r.members.map(m=>({...m}))});}}for(const user of localUsers){const profile=localProfile(user.id,await AsyncStorage.getItem(user.key));await renameLocalUser(user.id,profile.name);}for(const album of albums)rememberFriends(album);await persist();}}
async function localRequest(r:Request):Promise<Request>{if(Platform.OS!=='web')return r;return {...r,photos:await Promise.all(r.photos.map(async p=>{try{return {...p,thumbnail:await photoFileUrl(p.thumbnail)}}catch{return {...p,thumbnail:'',unavailable:true}}}))};}
export async function listRequests():Promise<Request[]>{if(!supabase)return Promise.all(local.map(localRequest));const rows=checked(await supabase.from('requests').select('*').order('created_at',{ascending:false}));return Promise.all(rows.map(row=>loadRequest(row.id)));}
export async function loadRequest(id:string):Promise<Request>{
 if(!supabase){const r=local.find(r=>r.id===id);if(!r)throw new Error('요청을 찾을 수 없어요.');return localRequest(r);}
 const [r,m,p,c,sub]=await Promise.all([supabase.from('requests').select('*').eq('id',id).single(),supabase.from('members').select('*').eq('request_id',id),supabase.from('photos').select('*').eq('request_id',id).order('created_at'),supabase.from('comments').select('*').eq('request_id',id).order('created_at'),supabase.from('submissions').select('*').eq('request_id',id)]);
 const row=checked(r);const photos=checked(p);const reactions=photos.length?checked(await supabase.from('reactions').select('*').in('photo_id',photos.map(p=>p.id))):[];
 const urls=await thumbnailUrls.get(photos.map(p=>p.thumbnail_path));
 const hydrated=photos.map((p,index)=>({id:p.id,requestId:id,filename:p.filename,mime:p.mime_type,width:p.width,height:p.height,bytes:p.byte_size,sha256:p.sha256,original:p.original_path,thumbnail:urls[index]}));
 return {id,albumId:row.album_id,simple:row.simple,publishedAt:row.published_at,inviteEnabled:row.invite_enabled,confirmedAt:row.confirmed_at,submissions:checked(sub).map(s=>({userId:s.user_id,selectedIds:s.selected_ids,createdAt:s.created_at})),ownerId:row.owner_id,title:row.title,inviteToken:row.invite_token,status:row.status,selectedIds:row.selected_ids,createdAt:row.created_at,members:checked(m).map(m=>({userId:m.user_id,nickname:m.nickname})),photos:hydrated,reactions:reactions.map(r=>({photoId:r.photo_id,userId:r.user_id,value:r.value})),comments:checked(c).map(c=>({id:c.id,photoId:c.photo_id,userId:c.user_id,body:c.body,createdAt:c.created_at}))};
}
export async function listAlbums():Promise<Album[]>{if(!supabase)return albums;const rows=checked(await supabase.from('albums').select('*').order('created_at',{ascending:false}));const refs=checked(await supabase.from('album_photo_sections').select('album_id,user_id,photo_id'));return Promise.all(rows.map(async a=>({id:a.id,title:a.title,createdAt:a.created_at,ownerId:a.owner_id,closedAt:a.closed_at,completedAt:a.completed_at,sectionPhotos:refs.filter(ref=>ref.album_id===a.id).map(ref=>({userId:ref.user_id,photoId:ref.photo_id})),members:checked(await supabase!.from('album_members').select('*').eq('album_id',a.id)).map(m=>({userId:m.user_id,nickname:m.nickname}))})));}
export async function createEvent(userId:string,nickname:string){
 if(!nickname.trim()||nickname.trim().length>20)throw new Error('닉네임을 1~20자로 입력해주세요.');
 if(supabase)return checked(await supabase.rpc('create_event',{p_nickname:nickname.trim()})) as string;
 const id=randomId(),albumId=randomId(),createdAt=new Date().toISOString(),members=[{userId,nickname:nickname.trim()}],previous=local,previousAlbums=albums;
 albums=[{id:albumId,title:'함께한 순간',createdAt,members,ownerId:userId,completedAt:null},...albums];
 local=[{id,albumId,submissions:[],ownerId:userId,title:`${nickname.trim()}의 사진`,inviteToken:randomId(),status:'selecting',selectedIds:[],createdAt,members,photos:[],reactions:[],comments:[]},...local];
 try{await persist();return id;}catch(error){local=previous;albums=previousAlbums;throw error;}
}
export async function renameEvent(event:Album,userId:string,title:string){
 const text=title.trim();if(!text||text.length>60)throw new Error('이벤트 이름을 1~60자로 입력해주세요.');
 if(!event.members.some(m=>m.userId===userId))throw new Error('이벤트 참여가 필요해요.');
 if(supabase){const rows=checked(await supabase.from('albums').update({title:text}).eq('id',event.id).select('id'));if(!rows.length)throw new Error('이벤트 이름을 바꿀 권한이 없어요.');return;}
 const previous=albums;albums=albums.map(a=>a.id===event.id?{...a,title:text}:a);try{await persist();}catch(error){albums=previous;throw error;}
}
export async function collectEventPhoto(event:Album,userId:string,photoId:string,include:boolean){
 const requests=supabase?await listRequests():visibleRequests(local,userId,blocks),next=setSectionPhoto(event,requests,userId,photoId,include);
 if(include&&!next.sectionPhotos?.some(ref=>ref.userId===userId&&ref.photoId===photoId))return;
 if(supabase){if(include)checked(await supabase.from('album_photo_sections').upsert({album_id:event.id,user_id:userId,photo_id:photoId},{onConflict:'album_id,user_id,photo_id',ignoreDuplicates:true}));else checked(await supabase.from('album_photo_sections').delete().eq('album_id',event.id).eq('user_id',userId).eq('photo_id',photoId));return;}
 const previous=albums;albums=albums.map(a=>a.id===event.id?setSectionPhoto(a,requests,userId,photoId,include):a);try{await persist();}catch(error){albums=previous;throw error;}
}
export async function listFriends(userId:string):Promise<Member[]>{
 if(supabase)return checked(await supabase.from('friend_profiles').select('friend_id,nickname').eq('user_id',userId)).map(row=>({userId:row.friend_id,nickname:row.nickname}));
 return connections.filter(c=>c.userId===userId&&!blocks.some(b=>(b.userId===userId&&b.blockedId===c.friendId)||(b.blockedId===userId&&b.userId===c.friendId))).map(c=>({userId:c.friendId,nickname:c.nickname}));
}
export async function listEventInvites(userId:string):Promise<EventInvite[]>{
 if(supabase)return checked(await supabase.from('event_invitations').select('*').eq('invitee_id',userId).eq('status','pending')).map(row=>({id:row.id,albumId:row.album_id,title:row.title,inviterId:row.inviter_id,inviterName:row.inviter_name,inviteeId:row.invitee_id,status:row.status}));
 const friends=await listFriends(userId);return invitations.filter(i=>i.inviteeId===userId&&i.status==='pending'&&friends.some(f=>f.userId===i.inviterId)&&albums.some(a=>a.id===i.albumId&&!eventArchived(a,local)));
}
export async function inviteFriend(album:Album,userId:string,friendId:string){
 if(supabase){checked(await supabase.rpc('invite_event_friend',{p_album:album.id,p_friend:friendId}));return;}
 const current=albums.find(a=>a.id===album.id);if(!current?.members.some(m=>m.userId===userId)||eventArchived(current,local))throw new Error('초대할 수 없는 이벤트예요.');
 if(!(await listFriends(userId)).some(f=>f.userId===friendId))throw new Error('연결된 친구만 바로 초대할 수 있어요.');
 if(current.members.some(m=>m.userId===friendId))throw new Error('이미 참여 중인 친구예요.');
 if(current.members.length>=3)throw new Error('최대 3명까지 참여할 수 있어요.');
 if(!local.some(r=>r.albumId===album.id&&r.photos.length))throw new Error('사진을 먼저 올려주세요.');
 if(invitations.some(i=>i.albumId===album.id&&i.inviteeId===friendId&&i.status==='pending'))return;
 const previous=invitations;invitations=[...invitations,{id:randomId(),albumId:album.id,title:current.title,inviterId:userId,inviterName:current.members.find(m=>m.userId===userId)!.nickname,inviteeId:friendId,status:'pending'}];try{await persist();}catch(error){invitations=previous;throw error;}
}
export async function respondEventInvite(inviteId:string,userId:string,nickname:string,accept:boolean){
 if(supabase){return checked(await supabase.rpc('respond_event_invite',{p_invite:inviteId,p_accept:accept,p_nickname:nickname})) as string;}
 const invite=(await listEventInvites(userId)).find(i=>i.id===inviteId);if(!invite)throw new Error('이 초대를 사용할 수 없어요.');
 if(accept){const source=local.find(r=>r.albumId===invite.albumId&&r.status==='selecting'&&r.photos.length&&r.inviteEnabled!==false);if(!source)throw new Error('초대를 받을 수 없는 이벤트예요.');await joinRequest(source.inviteToken,userId,nickname);}
 const previous=invitations;invitations=invitations.map(i=>i.id===inviteId?{...i,status:accept?'accepted':'declined'}:i);try{await persist();}catch(error){invitations=previous;throw error;}return invite.albumId;
}
export async function closeEvent(album:Album,userId:string){
 if(supabase){checked(await supabase.rpc('close_event',{p_album:album.id}));return;}
 const current=albums.find(a=>a.id===album.id);if(current?.ownerId!==userId)throw new Error('이벤트를 만든 사람만 마감할 수 있어요.');
 const previous=albums;albums=albums.map(a=>a.id===album.id?{...a,closedAt:a.closedAt||new Date().toISOString()}:a);try{await persist();}catch(error){albums=previous;throw error;}
}
export async function createAlbum(userId:string,title:string,nickname:string){if(!title.trim()||title.trim().length>60)throw new Error('앨범 이름을 1~60자로 입력해주세요.');if(!nickname.trim())throw new Error('닉네임을 먼저 설정해주세요.');if(supabase)return checked(await supabase.rpc('create_album',{p_title:title.trim(),p_nickname:nickname.trim()})) as string;const id=randomId();albums=[{id,title:title.trim(),createdAt:new Date().toISOString(),members:[{userId,nickname}]},...albums];await persist();return id;}
export async function createRequest(userId:string,title:string,nickname:string,albumId:string){if(!title.trim()||title.trim().length>60)throw new Error('제목을 1~60자로 입력해주세요.');if(!nickname.trim()||nickname.trim().length>20)throw new Error('닉네임을 1~20자로 입력해주세요.');if(supabase)return checked(await supabase.rpc('create_album_request',{p_album:albumId,p_title:title.trim(),p_nickname:nickname.trim()})) as string;
 assertEventOpen(albumId);const album=albums.find(a=>a.id===albumId);if(!album?.members.some(m=>m.userId===userId))throw new Error('앨범 참여가 필요해요.');album.members=album.members.map(m=>m.userId===userId?{...m,nickname:nickname.trim()}:m);const id=randomId();local=[{id,albumId,submissions:[],ownerId:userId,title:title.trim(),inviteToken:randomId(),status:'selecting',selectedIds:[],createdAt:new Date().toISOString(),members:album.members.map(m=>({...m})),photos:[],reactions:[],comments:[]},...local];await persist();return id;}
export async function submit(r:Request,userId:string){assertVoter(r,userId);if(!supabase)assertEventOpen(r.albumId);if(supabase){checked(await supabase.rpc('submit_selection',{p_request:r.id}));return;}await replace(r.id,current=>submitSelection(current,userId));}
export type InvitePreview={title:string;owner:string;status:string;simple?:boolean;photoCount?:number};
export async function previewInvite(token:string):Promise<InvitePreview>{if(supabase){const data=checked(await supabase.rpc('preview_invite',{p_token:token}));if(!data)throw new Error('사용할 수 없는 초대예요.');return data;}const r=local.find(r=>r.inviteToken===token);if(!r||r.inviteEnabled===false||(r.simple&&!r.publishedAt))throw new Error('사용할 수 없는 초대예요.');return {title:r.title,owner:r.members.find(m=>m.userId===r.ownerId)!.nickname,status:r.status,simple:r.simple,photoCount:r.photos.length};}
export async function createQuickRequest(userId:string,nickname:string){
 if(!nickname.trim()||nickname.trim().length>20)throw new Error('닉네임을 1~20자로 입력해주세요.');
 if(supabase)return checked(await supabase.rpc('create_simple_request',{p_nickname:nickname.trim()})) as string;
 const id=randomId(),albumId=randomId(),createdAt=new Date().toISOString(),members=[{userId,nickname:nickname.trim()}],previous=local,previousAlbums=albums;
 albums=[{id:albumId,title:'사진 셀렉',createdAt,members},...albums];
 local=[{id,albumId,simple:true,publishedAt:null,submissions:[],ownerId:userId,title:'어떤 사진이 제일 좋아?',inviteToken:randomId(),status:'selecting',selectedIds:[],createdAt,members,photos:[],reactions:[],comments:[]},...local];
 const next=local,nextAlbums=albums;
 try{await persist();return id;}catch(error){if(local===next)local=previous;if(albums===nextAlbums)albums=previousAlbums;throw error;}
}
export async function publish(r:Request,userId:string,title:string){if(supabase){const text=title.trim()||'어떤 사진이 제일 좋아?';if(!r.publishedAt){const result=checked(await supabase.functions.invoke('app-actions',{body:{action:'moderate',requestId:r.id,title:text,consentVersion:'2026-10-22'}}));if(!result.approved)throw new Error('공유할 수 없는 사진이나 문구가 포함돼 있어요. 운영자에게 문의하거나 새 셀렉을 준비해주세요.');}checked(await supabase.rpc('publish_request',{p_request:r.id,p_title:text}));return;}await replace(r.id,current=>publishRequest(current,userId,title));}
export async function acceptTerms(){if(supabase)checked(await supabase.rpc('accept_terms',{p_version:'2026-10-22'}));await AsyncStorage.setItem('seollek-terms-version','2026-10-22');}
export async function joinRequest(token:string,userId:string,nickname:string){
 if(!nickname.trim()||nickname.trim().length>20)throw new Error('이름을 1~20자로 입력해주세요.');
 if(supabase)return checked(await supabase.rpc('join_request',{p_token:token,p_nickname:nickname.trim()})) as string;
 const r=local.find(r=>r.inviteToken===token);
 if(!r||r.inviteEnabled===false||(r.simple&&!r.publishedAt)||(r.status==='confirmed'&&!r.members.some(m=>m.userId===userId)))throw new Error('사용할 수 없는 초대예요.');
 const album=albums.find(a=>a.id===r.albumId);if(!album||eventArchived(album,local)||album.members.some(m=>blocks.some(b=>(b.userId===userId&&b.blockedId===m.userId)||(b.blockedId===userId&&b.userId===m.userId))))throw new Error('사용할 수 없는 초대예요.');
 if(!album.members.some(m=>m.userId===userId)){if(album.members.length>=3)throw new Error('최대 3명까지 참여할 수 있어요.');album.members.push({userId,nickname:nickname.trim()});}
 for(const request of local.filter(item=>item.albumId===album.id))if(!request.members.some(m=>m.userId===userId))request.members.push({userId,nickname:nickname.trim()});
 rememberFriends(album);await persist();return r.id;
}
async function replace(id:string,transform:(r:Request)=>Request){const previous=local;const next=local.map(r=>r.id===id?transform(r):r);local=next;try{await persist()}catch(error){if(local===next)local=previous;throw error;}}
export async function react(r:Request,userId:string,photoId:string,value:Choice|null){assertVoter(r,userId);if(!supabase)assertEventOpen(r.albumId);if(supabase){checked(await supabase.rpc('set_reaction',{p_photo:photoId,p_value:value}));return;}await replace(r.id,current=>setChoice(current,userId,photoId,value));}
export async function comment(r:Request,userId:string,photoId:string|null,body:string){if(!supabase)assertEventOpen(r.albumId);if(supabase){checked(await supabase.rpc('add_comment',{p_request:r.id,p_photo:photoId,p_body:body}));return;}await replace(r.id,current=>addComment(current,userId,photoId,body,randomId()));}
export async function finalize(r:Request,userId:string,ids:string[]){if(!supabase)assertEventOpen(r.albumId);if(supabase){checked(await supabase.rpc('confirm_request',{p_request:r.id,p_selected:ids}));return;}await replace(r.id,current=>confirm(current,userId,ids));}
async function bytes(uri:string){if(Platform.OS==='web')return (await fetch(uri)).arrayBuffer();return new File(uri).arrayBuffer();}
export type UploadAsset=Omit<ImagePickerAsset,'file'>&{file?:Blob};
export async function upload(r:Request,userId:string,asset:UploadAsset,photoId:string,onStage?:(stage:UploadStage)=>void):Promise<Photo|void>{
 assertOwner(r,userId);assertOpen(r);if(!supabase)assertEventOpen(r.albumId);
 if(supabase){const existing=checked(await supabase.from('photos').select('id').eq('id',photoId));if(existing.length)return;}
 else{const existing=local.find(item=>item.id===r.id)?.photos.find(photo=>photo.id===photoId);if(existing)return existing;}
 assertUploadable(r,userId);
 const mime=asset.mimeType||'image/jpeg';if(!['image/jpeg','image/png','image/heic','image/heif','image/webp'].includes(mime))throw new Error('JPEG·PNG·HEIC·WebP 사진만 지원해요.');
 const ext=mime==='image/heic'?'heic':mime==='image/heif'?'heif':mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
 const filename=`${photoId}.${ext}`;
 if(Platform.OS==='web')return uploadWeb(r,userId,asset,photoId,mime,filename,onStage);
 onStage?.('read');
 let originalBytes:ArrayBuffer;
 try{originalBytes=asset.file?await asset.file.arrayBuffer():await bytes(asset.uri);if(!originalBytes.byteLength)throw new Error('사진 파일이 비어 있어요.');}catch(error){throw uploadError('read',error,mime);}
 if(originalBytes.byteLength>25*1024*1024)throw new Error('사진 한 장은 최대 25MB까지 지원해요.');
 onStage?.('hash');const checksum=await sha256(originalBytes);
 onStage?.('preview');
 let thumb:Awaited<ReturnType<typeof manipulateAsync>>;
 try{thumb=await manipulateAsync(asset.uri,[{resize:thumbnailSize(asset.width,asset.height)}],{compress:.75,format:SaveFormat.JPEG});}catch(error){throw uploadError('preview',error,mime);}
 onStage?.(supabase?'transfer':'store');
 if(supabase){const originalPath=`${r.id}/original/${photoId}/${filename}`,thumbnailPath=`${r.id}/thumbnail/${photoId}.jpg`,uploaded:string[]=[];try{checked(await supabase.storage.from('request-photos').upload(originalPath,originalBytes,{contentType:mime}));uploaded.push(originalPath);checked(await supabase.storage.from('request-photos').upload(thumbnailPath,await bytes(thumb.uri),{contentType:'image/jpeg'}));uploaded.push(thumbnailPath);checked(await supabase.rpc('register_photo',{p_id:photoId,p_request:r.id,p_filename:filename,p_mime:mime,p_width:asset.width,p_height:asset.height,p_bytes:originalBytes.byteLength,p_sha256:checksum}));}catch(error){const registered=await supabase.from('photos').select('id').eq('id',photoId);if(!registered.error&&!registered.data?.length&&uploaded.length)await supabase.storage.from('request-photos').remove(uploaded);throw error;}return {id:photoId,requestId:r.id,filename,mime,width:asset.width,height:asset.height,bytes:originalBytes.byteLength,sha256:checksum,original:originalPath,thumbnail:thumb.uri};}
 onStage?.('store');
 const originalFile=new File(Paths.document,filename);originalFile.writeSync(new Uint8Array(originalBytes));const thumbFile=new File(Paths.document,`${photoId}-thumb.jpg`);new File(thumb.uri).copy(thumbFile);const original=originalFile.uri,thumbnail=thumbFile.uri;
 const photo:Photo={id:photoId,requestId:r.id,filename,mime,width:asset.width,height:asset.height,bytes:originalBytes.byteLength,sha256:checksum,original,thumbnail};
 try{await replace(r.id,current=>{assertUploadable(current,userId);return current.photos.some(p=>p.id===photo.id)?current:{...current,submissions:[],photos:[...current.photos,photo]};});}catch(error){throw uploadError('store',error,mime);}
 return photo;
}
async function uploadWeb(r:Request,userId:string,asset:UploadAsset,photoId:string,mime:string,filename:string,onStage?:(stage:UploadStage)=>void):Promise<Photo>{
 onStage?.('read');let original:Blob;
 try{original=asset.file||await (await fetch(asset.uri)).blob();if(!original.size)throw new Error('사진 파일이 비어 있어요.');if(original.size>25*1024*1024)throw new Error('사진 한 장은 최대 25MB까지 지원해요.');}catch(error){throw uploadError('read',error,mime)}
 onStage?.('hash');const checksum=await sha256Blob(original);
 onStage?.('preview');let preview:Awaited<ReturnType<typeof createWebThumbnail>>;
 try{preview=await createWebThumbnail(original)}catch(error){throw uploadError('preview',error,mime)}
 let originalRef:string,thumbnailRef:string;
 if(supabase){
  onStage?.('transfer');originalRef=`${r.id}/original/${photoId}/${filename}`;thumbnailRef=`${r.id}/thumbnail/${photoId}.jpg`;const uploaded:string[]=[];
  try{checked(await supabase.storage.from('request-photos').upload(originalRef,original,{contentType:mime}));uploaded.push(originalRef);checked(await supabase.storage.from('request-photos').upload(thumbnailRef,preview.blob,{contentType:'image/jpeg'}));uploaded.push(thumbnailRef);checked(await supabase.rpc('register_photo',{p_id:photoId,p_request:r.id,p_filename:filename,p_mime:mime,p_width:preview.width,p_height:preview.height,p_bytes:original.size,p_sha256:checksum}));}
  catch(error){if(uploaded.length){const registered=await supabase.from('photos').select('id').eq('id',photoId);if(!registered.error&&!registered.data?.length)await supabase.storage.from('request-photos').remove(uploaded);}throw uploadError('transfer',error,mime)}
 }else{
  onStage?.('store');try{const saved=await storePhotoFiles(photoId,original,preview.blob);originalRef=saved.original;thumbnailRef=saved.thumbnail;}catch(error){throw uploadError('store',error,mime)}
 }
 const photo:Photo={id:photoId,requestId:r.id,filename,mime,width:preview.width,height:preview.height,bytes:original.size,sha256:checksum,original:originalRef,thumbnail:thumbnailRef};
 if(!supabase){try{await replace(r.id,current=>{assertUploadable(current,userId);return current.photos.some(p=>p.id===photoId)?current:{...current,submissions:[],photos:[...current.photos,photo]}})}catch(error){throw uploadError('store',error,mime)}}
 return photo;
}
export async function originalUrl(photo:Photo){if(!supabase)return Platform.OS==='web'?photoFileUrl(photo.original):photo.original;return checked(await supabase.storage.from('request-photos').createSignedUrl(photo.original,120)).signedUrl;}
export async function renameLocalUser(userId:string,name:string){
 if(supabase)throw new Error('로컬 모드에서만 사용할 수 있어요.');
 localProfile(userId);if(!name.trim()||name.trim().length>20)throw new Error('이름을 1~20자로 입력해주세요.');
 const rename=(members:Member[])=>members.map(member=>member.userId===userId?{...member,nickname:name}:member);
 local=local.map(r=>({...r,members:rename(r.members)}));albums=albums.map(a=>({...a,members:rename(a.members)}));connections=connections.map(c=>c.friendId===userId?{...c,nickname:name}:c);invitations=invitations.map(i=>i.inviterId===userId?{...i,inviterName:name}:i);await persist();
}
export async function prepareLocalUser(r:Request|undefined,userId:string,name:string){
 if(supabase)throw new Error('로컬 모드에서만 사용할 수 있어요.');localProfile(userId);
 if(r&&!r.members.some(member=>member.userId===userId))await joinRequest(r.inviteToken,userId,name);
 await renameLocalUser(userId,name);
}
export const localBlocks=()=>blocks;
export async function manageInvite(r:Request,userId:string,enabled:boolean){
 assertOwner(r,userId);
 if(supabase){checked(await supabase.rpc('manage_invite',{p_request:r.id,p_enabled:enabled}));return;}
 await replace(r.id,current=>({...current,inviteToken:randomId(),inviteEnabled:enabled}));
}
export async function reportContent(r:Request,userId:string,photoId:string|null,targetId:string|null,reason:ReportReason,details:string){
 const validated=validateReport(reason,details);
 if(!r.members.some(m=>m.userId===userId)||(photoId&&!r.photos.some(p=>p.id===photoId))||(targetId&&!r.members.some(m=>m.userId===targetId)))throw new Error('신고 대상을 확인해주세요.');
 if(supabase){checked(await supabase.rpc('report_content',{p_request:r.id,p_photo:photoId,p_target:targetId,p_reason:validated.reason,p_details:validated.details}));return;}
 reports.push({requestId:r.id,photoId,targetId,...validated,createdAt:new Date().toISOString()});await persist();
}
export async function blockUser(r:Request,userId:string,targetId:string){
 if(targetId===userId||![userId,targetId].every(id=>r.members.some(m=>m.userId===id)))throw new Error('차단할 참여자를 확인해주세요.');
 if(supabase){checked(await supabase.rpc('block_user',{p_request:r.id,p_user:targetId}));return;}
 if(!blocks.some(b=>b.userId===userId&&b.blockedId===targetId))blocks.push({userId,blockedId:targetId});await persist();
}
export async function deleteRequest(r:Request,userId:string){
 assertOwner(r,userId);
 if(supabase){checked(await supabase.rpc('begin_request_deletion',{p_request:r.id}));let pending=false;try{const result=checked(await supabase.functions.invoke('app-actions',{body:{action:'cleanup'}}));pending=!!result.pending;}catch{pending=true;}await clearDeviceData(r.id,r.photos.map(p=>p.id));return {pending};}
 await clearDeviceData(r.id,r.photos.map(p=>p.id));local=local.filter(item=>item.id!==r.id);albums=albums.filter(a=>a.id!==r.albumId||local.some(item=>item.albumId===a.id)).map(a=>({...a,sectionPhotos:a.sectionPhotos?.filter(ref=>!r.photos.some(photo=>photo.id===ref.photoId))}));reports=reports.filter(item=>item.requestId!==r.id);await persist();return {pending:false};
}
export async function accountStatus():Promise<'active'|'deleting'|'unavailable'>{return supabase?checked(await supabase.rpc('account_status')):'active';}
export async function submitFeedback(userId:string,kind:FeedbackKind,body:string){
 const input=feedbackInput(kind,body);
 if(!supabase){await AsyncStorage.setItem(`seollek-feedback-draft:${userId}`,JSON.stringify(input));return {delivered:false};}
 const id=checked(await supabase.rpc('submit_feedback',{p_kind:input.kind,p_body:input.body}));return {delivered:true,id};
}
export async function clearEventHistory(userId:string){
 if(!userId)throw new Error('계정을 확인한 뒤 다시 시도해주세요.');
 const key=`seollek-history-reset:${userId}`,raw=await AsyncStorage.getItem(key);
 let plan:{userId:string;accepted:boolean;uploads:{id:string;photoIds:string[]}[]};
 if(raw){plan=JSON.parse(raw);if(plan.userId!==userId||typeof plan.accepted!=='boolean'||!Array.isArray(plan.uploads)||plan.uploads.some(r=>typeof r.id!=='string'||!Array.isArray(r.photoIds)||r.photoIds.some(id=>typeof id!=='string')))throw new Error('삭제 복구 기록을 확인할 수 없어요. 문의해주세요.');}
 else{plan={userId,accepted:false,uploads:(supabase?await listRequests():local).filter(r=>r.ownerId===userId).map(r=>({id:r.id,photoIds:r.photos.map(p=>p.id)}))};await AsyncStorage.setItem(key,JSON.stringify(plan));}
 if(!plan.accepted){if(supabase)checked(await supabase.rpc('clear_event_history'));plan.accepted=true;await AsyncStorage.setItem(key,JSON.stringify(plan));}
 for(const upload of plan.uploads)await clearDeviceData(upload.id,upload.photoIds);
 const keys=await AsyncStorage.getAllKeys();await AsyncStorage.multiRemove(keys.filter(k=>['seollek-album-save:','seollek-photo-assets:','seollek-extra-picks:','seollek-native-upload:'].some(prefix=>k.startsWith(`${prefix}${userId}:`))));
 if(!supabase){
  await localWrites;local=local.filter(r=>r.ownerId!==userId).map(r=>({...r,members:r.members.filter(m=>m.userId!==userId),reactions:r.reactions.filter(v=>v.userId!==userId),comments:r.comments.filter(c=>c.userId!==userId),submissions:r.submissions?.filter(s=>s.userId!==userId)}));
  albums=albums.map(a=>{const members=a.members.filter(m=>m.userId!==userId);return {...a,members,ownerId:a.ownerId===userId?members[0]?.userId:a.ownerId,sectionPhotos:a.sectionPhotos?.filter(ref=>ref.userId!==userId&&local.some(r=>r.photos.some(p=>p.id===ref.photoId)))};}).filter(a=>a.members.length&&local.some(r=>r.albumId===a.id));
  invitations=invitations.filter(i=>i.inviterId!==userId&&i.inviteeId!==userId);await persist();
 }
 thumbnailUrls.clear();let pending=false;
 if(supabase){try{const result=checked(await supabase.functions.invoke('app-actions',{body:{action:'cleanup'}}));pending=!!result.pending;}catch{pending=true;}}
 await AsyncStorage.removeItem(key);return {pending};
}
export async function deleteAccount(){
 await deleteAccountData({
  queued:async()=>await AsyncStorage.getItem('seollek-deletion-pending')==='queued',
  markRequested:()=>AsyncStorage.setItem('seollek-deletion-pending','requested'),
  begin:async()=>{if(supabase&&await accountStatus()!=='deleting')checked(await supabase.rpc('begin_account_deletion'));},
  markQueued:()=>AsyncStorage.setItem('seollek-deletion-pending','queued'),
  cleanDevice:async()=>{if(supabase){try{checked(await supabase.functions.invoke('app-actions',{body:{action:'cleanup'}}));}catch{/* Server job continues without this session. */}}else{await localWrites;local=[];albums=[];blocks=[];reports=[];connections=[];invitations=[];}thumbnailUrls.clear();await clearDeviceData();},
  signOut:async()=>{if(supabase){const result=await supabase.auth.signOut({scope:'local'});if(result.error)throw result.error;}},
  receipt:async()=>{await AsyncStorage.setItem('seollek-deletion-receipt','true');await AsyncStorage.removeItem('seollek-deletion-pending');},
 });
}
export function localVisibleRequests(requests:Request[],userId:string){return supabase?requests:visibleRequests(requests,userId,blocks);}
