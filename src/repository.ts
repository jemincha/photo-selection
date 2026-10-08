import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { File,Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { manipulateAsync,SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import {supabase,checked} from './backend';
import {Request,Photo,Choice,assertOpen,assertOwner,setChoice,confirm,addComment} from './domain';
const key='photo-selection-mvp-v1';
let local:Request[]=[];
let localWrites=Promise.resolve();
async function persist(){const snapshot=JSON.stringify(local);localWrites=localWrites.catch(()=>{}).then(()=>AsyncStorage.setItem(key,snapshot));await localWrites;}
export async function initialize(){if(!supabase){local=JSON.parse(await AsyncStorage.getItem(key)||'[]');}}
export async function listRequests():Promise<Request[]>{if(!supabase)return local;const rows=checked(await supabase.from('requests').select('*').order('created_at',{ascending:false}));return Promise.all(rows.map(row=>loadRequest(row.id)));}
export async function loadRequest(id:string):Promise<Request>{
 if(!supabase){const r=local.find(r=>r.id===id);if(!r)throw new Error('요청을 찾을 수 없어요.');return r;}
 const [r,m,p,c]=await Promise.all([supabase.from('requests').select('*').eq('id',id).single(),supabase.from('members').select('*').eq('request_id',id),supabase.from('photos').select('*').eq('request_id',id).order('created_at'),supabase.from('comments').select('*').eq('request_id',id).order('created_at')]);
 const row=checked(r);const photos=checked(p);const reactions=photos.length?checked(await supabase.from('reactions').select('*').in('photo_id',photos.map(p=>p.id))):[];
 const hydrated=await Promise.all(photos.map(async p=>{const signed=checked(await supabase!.storage.from('request-photos').createSignedUrl(p.thumbnail_path,3600));return {id:p.id,requestId:id,filename:p.filename,mime:p.mime_type,width:p.width,height:p.height,bytes:p.byte_size,original:p.original_path,thumbnail:signed.signedUrl};}));
 return {id,ownerId:row.owner_id,title:row.title,inviteToken:row.invite_token,status:row.status,selectedIds:row.selected_ids,createdAt:row.created_at,members:checked(m).map(m=>({userId:m.user_id,nickname:m.nickname})),photos:hydrated,reactions:reactions.map(r=>({photoId:r.photo_id,userId:r.user_id,value:r.value})),comments:checked(c).map(c=>({id:c.id,photoId:c.photo_id,userId:c.user_id,body:c.body,createdAt:c.created_at}))};
}
export async function createRequest(userId:string,title:string,nickname:string){if(!title.trim()||title.trim().length>60)throw new Error('제목을 1~60자로 입력해주세요.');if(!nickname.trim()||nickname.trim().length>20)throw new Error('이름을 1~20자로 입력해주세요.');if(supabase)return checked(await supabase.rpc('create_request',{p_title:title.trim(),p_nickname:nickname.trim()})) as string;
 const id=Crypto.randomUUID();local=[{id,ownerId:userId,title:title.trim(),inviteToken:Crypto.randomUUID(),status:'selecting',selectedIds:[],createdAt:new Date().toISOString(),members:[{userId,nickname}],photos:[],reactions:[],comments:[]},...local];await persist();return id;}
export async function previewInvite(token:string):Promise<{title:string;owner:string;status:string}>{if(supabase){const data=checked(await supabase.rpc('preview_invite',{p_token:token}));if(!data)throw new Error('사용할 수 없는 초대예요.');return data;}const r=local.find(r=>r.inviteToken===token);if(!r)throw new Error('로컬 모드의 초대는 같은 기기에서만 열 수 있어요.');return {title:r.title,owner:r.members.find(m=>m.userId===r.ownerId)!.nickname,status:r.status};}
export async function joinRequest(token:string,userId:string,nickname:string){if(!nickname.trim()||nickname.length>20)throw new Error('이름을 1~20자로 입력해주세요.');if(supabase)return checked(await supabase.rpc('join_request',{p_token:token,p_nickname:nickname.trim()})) as string;const r=local.find(r=>r.inviteToken===token);if(!r)throw new Error('초대를 찾을 수 없어요.');if(!r.members.some(m=>m.userId===userId)){assertOpen(r);if(r.members.length>=3)throw new Error('최대 3명까지 참여할 수 있어요.');r.members.push({userId,nickname:nickname.trim()});await persist();}return r.id;}
async function replace(id:string,transform:(r:Request)=>Request){local=local.map(r=>r.id===id?transform(r):r);await persist();}
export async function react(r:Request,userId:string,photoId:string,value:Choice|null){if(supabase){checked(await supabase.rpc('set_reaction',{p_photo:photoId,p_value:value}));return;}await replace(r.id,current=>setChoice(current,userId,photoId,value));}
export async function comment(r:Request,userId:string,photoId:string|null,body:string){if(supabase){checked(await supabase.rpc('add_comment',{p_request:r.id,p_photo:photoId,p_body:body}));return;}await replace(r.id,current=>addComment(current,userId,photoId,body,Crypto.randomUUID()));}
export async function finalize(r:Request,userId:string,ids:string[]){if(supabase){checked(await supabase.rpc('confirm_request',{p_request:r.id,p_selected:ids}));return;}await replace(r.id,current=>confirm(current,userId,ids));}
async function bytes(uri:string){if(Platform.OS==='web')return (await fetch(uri)).arrayBuffer();return new File(uri).arrayBuffer();}
export async function upload(r:Request,userId:string,asset:ImagePickerAsset,photoId:string):Promise<void>{
 assertOwner(r,userId);assertOpen(r);
 const mime=asset.mimeType||'image/jpeg';if(!['image/jpeg','image/png','image/heic','image/heif','image/webp'].includes(mime))throw new Error('JPEG·PNG·HEIC·WebP 사진만 지원해요.');
 const ext=mime==='image/heic'?'heic':mime==='image/heif'?'heif':mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
 const filename=`${photoId}.${ext}`;
 const originalBytes=await bytes(asset.uri);if(originalBytes.byteLength>25*1024*1024)throw new Error('사진 한 장은 최대 25MB까지 지원해요.');
 const thumb=await manipulateAsync(asset.uri,[{resize:{width:720}}],{compress:.75,format:SaveFormat.JPEG});
 if(supabase){const originalPath=`${r.id}/original/${photoId}/${filename}`,thumbnailPath=`${r.id}/thumbnail/${photoId}.jpg`;try{checked(await supabase.storage.from('request-photos').upload(originalPath,originalBytes,{contentType:mime}));checked(await supabase.storage.from('request-photos').upload(thumbnailPath,await bytes(thumb.uri),{contentType:'image/jpeg'}));checked(await supabase.rpc('register_photo',{p_id:photoId,p_request:r.id,p_filename:filename,p_mime:mime,p_width:asset.width,p_height:asset.height,p_bytes:originalBytes.byteLength}));}catch(error){await supabase.storage.from('request-photos').remove([originalPath,thumbnailPath]);throw error;}return;}
 let original=asset.uri,thumbnail=thumb.uri;
 if(Platform.OS!=='web'){const originalFile=new File(Paths.document,filename);originalFile.write(new Uint8Array(originalBytes));const thumbFile=new File(Paths.document,`${photoId}-thumb.jpg`);new File(thumb.uri).copy(thumbFile);original=originalFile.uri;thumbnail=thumbFile.uri;}
 else{const toDataUrl=async(uri:string)=>new Promise<string>(async(resolve,reject)=>{try{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('사진 읽기 실패'));reader.readAsDataURL(await (await fetch(uri)).blob());}catch(e){reject(e)}});original=await toDataUrl(asset.uri);thumbnail=await toDataUrl(thumb.uri);}
 const photo:Photo={id:photoId,requestId:r.id,filename,mime,width:asset.width,height:asset.height,bytes:originalBytes.byteLength,original,thumbnail};
 await replace(r.id,current=>{assertOwner(current,userId);assertOpen(current);return {...current,photos:[...current.photos,photo]};});
}
export async function originalUrl(photo:Photo){if(!supabase)return photo.original;return checked(await supabase.storage.from('request-photos').createSignedUrl(photo.original,600)).signedUrl;}
export async function localFriend(r:Request){if(supabase)throw new Error('로컬 모드에서만 사용할 수 있어요.');await joinRequest(r.inviteToken,'local-friend','테스트 친구');}
