export type Choice = 'dislike' | 'unsure' | 'like';
export type Photo = { id:string; requestId:string; filename:string; mime:string; width:number; height:number; bytes:number; original:string; thumbnail:string };
export type Member = { userId:string; nickname:string };
export type Reaction = { photoId:string; userId:string; value:Choice };
export type Comment = { id:string; photoId:string|null; userId:string; body:string; createdAt:string };
export type Request = { id:string; ownerId:string; title:string; inviteToken:string; status:'selecting'|'confirmed'; selectedIds:string[]; createdAt:string; members:Member[]; photos:Photo[]; reactions:Reaction[]; comments:Comment[] };
export const choiceLabel:Record<Choice,string> = {dislike:'별로',unsure:'글쎄',like:'좋아'};
export function assertOpen(request:Request){if(request.status!=='selecting')throw new Error('이미 확정된 요청이에요.');}
export function assertMember(request:Request,userId:string){if(!request.members.some(m=>m.userId===userId))throw new Error('이 요청에 참여할 권한이 없어요.');}
export function assertOwner(request:Request,userId:string){assertMember(request,userId);if(request.ownerId!==userId)throw new Error('요청자만 할 수 있는 작업이에요.');}
export function setChoice(request:Request,userId:string,photoId:string,value:Choice|null):Request {
 assertMember(request,userId);assertOpen(request);if(!request.photos.some(p=>p.id===photoId))throw new Error('사진을 찾을 수 없어요.');
 return {...request,reactions:[...request.reactions.filter(r=>!(r.photoId===photoId&&r.userId===userId)),...(value?[{photoId,userId,value}]:[])]};
}
export function confirm(request:Request,userId:string,ids:string[]):Request {
 assertOwner(request,userId);assertOpen(request);if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!request.photos.some(p=>p.id===id)))throw new Error('확정할 사진을 다시 확인해주세요.');
 return {...request,status:'confirmed',selectedIds:[...ids]};
}
export function addComment(request:Request,userId:string,photoId:string|null,body:string,id:string):Request {
 assertMember(request,userId);assertOpen(request);const text=body.trim();if(!text||text.length>500)throw new Error('의견은 1~500자로 입력해주세요.');if(photoId&&!request.photos.some(p=>p.id===photoId))throw new Error('사진을 찾을 수 없어요.');
 return {...request,comments:[...request.comments,{id,userId,photoId,body:text,createdAt:new Date().toISOString()}]};
}
export function nickname(request:Request,userId:string){return request.members.find(m=>m.userId===userId)?.nickname||'친구';}
export function choiceFor(request:Request,userId:string,photoId:string){return request.reactions.find(r=>r.userId===userId&&r.photoId===photoId)?.value||null;}
