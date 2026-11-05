import type {Album,Photo,Request,Choice} from './domain';

export function eventKind(event:Album,requests:Request[],userId:string){
 const uploaded=requests.filter(r=>r.albumId===event.id&&r.photos.length),own=uploaded.some(r=>r.ownerId===userId),others=uploaded.some(r=>r.ownerId!==userId);
 return own&&others?'함께한 이벤트':own?'보낸 요청':others?'받은 요청':event.ownerId===userId?'보낸 요청':'받은 요청';
}
export function eventArchived(event:Album,requests:Request[]){
 if(event.closedAt||event.completedAt)return true;
 if('completedAt' in event)return false;
 const batches=requests.filter(r=>r.albumId===event.id);
 return batches.length>0&&batches.every(r=>r.photos.length>0&&r.status==='confirmed');
}
export function friendVotes(request:Request,photoId:string){
 const counts:Record<Choice,number>={like:0,unsure:0,dislike:0};
 for(const member of request.members.filter(m=>m.userId!==request.ownerId)){const vote=request.reactions.find(r=>r.photoId===photoId&&r.userId===member.userId);if(vote)counts[vote.value]++;}
 // Conservative grouping keeps mixed votes visible instead of hiding disagreement.
 const group:Choice|'unclassified'=counts.like?'like':counts.unsure?'unsure':counts.dislike?'dislike':'unclassified';
 return {counts,group};
}

export type EventPhoto={photo:Photo;request:Request;uploadedBy:string;brought:boolean};
export function eventSections(event:Album,requests:Request[]){
 const sources=requests.filter(r=>r.albumId===event.id&&event.members.some(m=>m.userId===r.ownerId));
 const photos=new Map<string,EventPhoto>();
 for(const request of sources)for(const photo of request.photos)photos.set(photo.id,{photo,request,uploadedBy:request.ownerId,brought:false});
 return event.members.map(member=>{
  const own=[...photos.values()].filter(item=>item.uploadedBy===member.userId),ids=new Set(own.map(item=>item.photo.id));
  for(const ref of event.sectionPhotos||[]){const item=photos.get(ref.photoId);if(ref.userId===member.userId&&item&&!ids.has(ref.photoId)){own.push({...item,brought:true});ids.add(ref.photoId);}}
  return {...member,photos:own};
 });
}
export function setSectionPhoto(event:Album,requests:Request[],userId:string,photoId:string,include:boolean):Album{
 if(!event.members.some(m=>m.userId===userId))throw new Error('이벤트에 먼저 참여해주세요.');
 const source=requests.find(r=>r.albumId===event.id&&r.members.some(m=>m.userId===userId)&&r.photos.some(p=>p.id===photoId));
 if(!source)throw new Error('이 이벤트에서 볼 수 있는 사진만 가져올 수 있어요.');
 const refs=(event.sectionPhotos||[]).filter(ref=>ref.userId!==userId||ref.photoId!==photoId);
 if(include&&source.ownerId!==userId)refs.push({userId,photoId});
 return {...event,sectionPhotos:refs};
}
