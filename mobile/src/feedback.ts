export type FeedbackKind='bug'|'suggestion';
export function feedbackInput(kind:string,body:string){
 const text=body.trim();if(!['bug','suggestion'].includes(kind)||text.length<5||text.length>2000)throw new Error('종류를 고르고 내용을 5~2000자로 적어주세요.');
 return {kind:kind as FeedbackKind,body:text};
}
