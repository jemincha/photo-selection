export type Choice = 'dislike' | 'unsure' | 'like';
export type Album = {id:string;title:string;createdAt:string;members:Member[]};
export type Submission = {userId:string;selectedIds:string[];createdAt:string};
export type Photo = { id:string; requestId:string; filename:string; mime:string; width:number; height:number; bytes:number; sha256?:string; original:string; thumbnail:string; unavailable?:boolean };
export type Member = { userId:string; nickname:string };
export type Reaction = { photoId:string; userId:string; value:Choice };
export type Comment = { id:string; photoId:string|null; userId:string; body:string; createdAt:string };
export type Request = { id:string; albumId?:string; simple?:boolean; publishedAt?:string|null; inviteEnabled?:boolean; confirmedAt?:string|null; submissions?:Submission[]; ownerId:string; title:string; inviteToken:string; status:'selecting'|'confirmed'; selectedIds:string[]; createdAt:string; members:Member[]; photos:Photo[]; reactions:Reaction[]; comments:Comment[] };
export const choiceLabel:Record<Choice,string> = {dislike:'별로',unsure:'글쎄',like:'좋아'};
export function assertOpen(request:Request){if(request.status!=='selecting')throw new Error('이미 확정된 요청이에요.');}
export function assertMember(request:Request,userId:string){if(!request.members.some(m=>m.userId===userId))throw new Error('이 요청에 참여할 권한이 없어요.');}
export function assertOwner(request:Request,userId:string){assertMember(request,userId);if(request.ownerId!==userId)throw new Error('요청자만 할 수 있는 작업이에요.');}
export function assertUploadable(request:Request,userId:string){assertOwner(request,userId);assertOpen(request);if(request.simple&&request.publishedAt)throw new Error('이미 보낸 사진은 바꿀 수 없어요. 새 셀렉으로 보내주세요.');if(request.photos.length>=30)throw new Error('셀렉 하나에는 최대 30장까지 담을 수 있어요.');}
export function publishRequest(request:Request,userId:string,title:string):Request{
 assertOwner(request,userId);assertOpen(request);
 if(request.publishedAt)return request;
 if(!request.photos.length)throw new Error('사진을 준비한 뒤 보내주세요.');
 const text=title.trim()||'어떤 사진이 제일 좋아?';if(text.length>60)throw new Error('부탁은 60자까지 적을 수 있어요.');
 return {...request,title:text,publishedAt:new Date().toISOString()};
}
export function requestDestination(request:Request,userId:string):string{
 if(request.status==='confirmed')return `/requests/${request.id}/result`;
 if(!request.simple)return `/requests/${request.id}`;
 if(request.ownerId===userId)return `/requests/${request.id}/${request.publishedAt?'result':'upload'}`;
 if(request.submissions?.some(s=>s.userId===userId))return `/requests/${request.id}/photo?photoId=${request.photos[0]?.id||''}`;
 const photo=request.photos.find(p=>!choiceFor(request,userId,p.id))||request.photos[0];
 return photo?`/requests/${request.id}/photo?photoId=${photo.id}`:`/requests/${request.id}`;
}
export function submittedLikes(request:Request,photoId:string){return (request.submissions||[]).filter(s=>s.selectedIds.includes(photoId)).length;}
export function setChoice(request:Request,userId:string,photoId:string,value:Choice|null):Request {
 assertMember(request,userId);assertOpen(request);if(!request.photos.some(p=>p.id===photoId))throw new Error('사진을 찾을 수 없어요.');
 return {...request,submissions:request.submissions?.filter(s=>s.userId!==userId),reactions:[...request.reactions.filter(r=>!(r.photoId===photoId&&r.userId===userId)),...(value?[{photoId,userId,value}]:[])]};
}
export function submitSelection(request:Request,userId:string):Request {
 assertMember(request,userId);assertOpen(request);
 if(!request.photos.length||request.photos.some(p=>!choiceFor(request,userId,p.id)))throw new Error('모든 사진을 분류한 뒤 제출해주세요.');
 const submission={userId,selectedIds:request.photos.filter(p=>choiceFor(request,userId,p.id)==='like').map(p=>p.id),createdAt:new Date().toISOString()};
 return {...request,submissions:[...(request.submissions||[]).filter(s=>s.userId!==userId),submission]};
}
export function confirm(request:Request,userId:string,ids:string[]):Request {
 assertOwner(request,userId);assertOpen(request);if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!request.photos.some(p=>p.id===id)))throw new Error('확정할 사진을 다시 확인해주세요.');
 return {...request,status:'confirmed',confirmedAt:new Date().toISOString(),selectedIds:[...ids]};
}
export function addComment(request:Request,userId:string,photoId:string|null,body:string,id:string):Request {
 assertMember(request,userId);assertOpen(request);const text=body.trim();if(!text||text.length>500)throw new Error('의견은 1~500자로 입력해주세요.');if(photoId&&!request.photos.some(p=>p.id===photoId))throw new Error('사진을 찾을 수 없어요.');
 return {...request,comments:[...request.comments,{id,userId,photoId,body:text,createdAt:new Date().toISOString()}]};
}
export function nickname(request:Request,userId:string){return request.members.find(m=>m.userId===userId)?.nickname||'친구';}
export function choiceFor(request:Request,userId:string,photoId:string){return request.reactions.find(r=>r.userId===userId&&r.photoId===photoId)?.value||null;}

export function albumCover(requests:Request[]):Photo|undefined {
 for(const request of requests){
  const photo=request.status==='confirmed'?request.photos.find(p=>request.selectedIds.includes(p.id)):request.photos[0];
  if(photo)return photo;
 }
}

export function selectionSummary(request:Request,userId:string){
 const choices=new Map<string,Choice>();
 for(const reaction of request.reactions){
  if(reaction.userId===userId&&!choices.has(reaction.photoId))choices.set(reaction.photoId,reaction.value);
 }
 const counts:Record<Choice,number>={like:0,unsure:0,dislike:0},liked:Photo[]=[],remaining:Photo[]=[];
 for(const photo of request.photos){
  const choice=choices.get(photo.id);
  if(!choice)remaining.push(photo);
  else{counts[choice]++;if(choice==='like')liked.push(photo)}
 }
 return {counts,liked,remaining};
}
