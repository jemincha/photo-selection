import type {Request} from './domain';
export const reportReasons={sexual:'부적절한 성적 콘텐츠',violence:'폭력·위험한 콘텐츠',harassment:'괴롭힘·혐오',privacy:'동의 없는 사진·개인정보',other:'그 밖의 문제'} as const;
export type ReportReason=keyof typeof reportReasons;
export type Block={userId:string;blockedId:string};
export function visibleRequests(requests:Request[],userId:string,blocks:Block[],now=Date.now()){
 return requests.filter(r=>r.members.some(m=>m.userId===userId)&&(r.ownerId===userId||!r.members.some(m=>blocks.some(b=>(b.userId===userId&&b.blockedId===m.userId)||(b.blockedId===userId&&b.userId===m.userId))))&&!(r.confirmedAt&&Date.parse(r.confirmedAt)+30*86400000<=now));
}
export function validateReport(reason:string,details:string){if(!Object.hasOwn(reportReasons,reason)||details.trim().length>500)throw new Error('신고 사유와 내용을 확인해주세요.');return {reason:reason as ReportReason,details:details.trim()};}
