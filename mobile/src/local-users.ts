export const localUsers=[{id:'local-me',name:'철수',key:'photo-selection-nickname'},{id:'local-friend',name:'영희',key:'photo-selection-friend-nickname'}] as const;
export function localProfile(id:string,saved?:string|null){const user=localUsers.find(user=>user.id===id);if(!user)throw new Error('로컬 사용자를 확인할 수 없어요.');return {...user,name:!saved||['제민','테스트 친구'].includes(saved)?user.name:saved};}
