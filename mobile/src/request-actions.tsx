import {useState} from 'react';
import {router} from 'expo-router';
import {Modal,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Request} from './domain';
import {useStore,cloudEnabled} from './store';
import * as repo from './repository';
import {reportReasons} from './safety';
import type {ReportReason} from './safety';
import {Button,Field,styles,TaskState,useTask} from './ui';

export function RequestActions({request,photoId=null,disabled=false}:{request:Request;photoId?:string|null;disabled?:boolean}){
 const store=useStore(),task=useTask(),[open,setOpen]=useState(false),[action,setAction]=useState<'menu'|'report'|'delete'|'block'>('menu'),[target,setTarget]=useState(''),[reason,setReason]=useState<ReportReason>('privacy'),[details,setDetails]=useState(''),[notice,setNotice]=useState('');
 const owner=request.ownerId===store.userId,peers=request.members.filter(m=>m.userId!==store.userId);
 return <><Pressable accessibilityRole="button" accessibilityLabel="셀렉 관리와 신고" disabled={disabled} accessibilityState={{disabled}} onPress={()=>{setOpen(true);setAction('menu');setNotice('')}} style={{padding:12}}><Text style={styles.badge}>•••</Text></Pressable>
 <Modal visible={open} transparent animationType="slide" onRequestClose={()=>{if(!task.busy)setOpen(false)}}><View style={{flex:1,backgroundColor:'#0006',justifyContent:'flex-end'}}><Pressable accessibilityRole="button" accessibilityLabel="관리 메뉴 닫기" disabled={task.busy} style={{flex:1}} onPress={()=>setOpen(false)}/><SafeAreaView accessibilityViewIsModal style={{backgroundColor:'#fcfbf8',borderTopLeftRadius:26,borderTopRightRadius:26,maxHeight:'85%'}} edges={['bottom']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,gap:14}}>
 <Text accessibilityRole="header" style={styles.title}>{action==='report'?'무슨 문제가 있나요?':action==='delete'?'이 셀렉을 삭제할까요?':action==='block'?'이 참여자를 차단할까요?':'셀렉 관리'}</Text>
 {action==='menu'&&<>
  <Button label={photoId?'이 사진 신고':'셀렉·참여자 신고'} onPress={()=>{setTarget('');setAction('report')}}/>
  {peers.map(peer=><Button key={peer.userId} label={`${peer.nickname} 차단`} onPress={()=>{setTarget(peer.userId);setAction('block')}}/>)}
  {owner&&<><Text style={styles.muted}>초대를 중지해도 이미 참여한 친구는 계속 볼 수 있어요. 차단은 참여자별로 할 수 있어요.</Text><Button label={request.inviteEnabled===false?'새 링크로 초대 다시 열기':'기존 초대 폐기 · 새 링크 만들기'} disabled={task.busy} onPress={()=>void task.run(async()=>{await repo.manageInvite(request,store.userId,true);await store.refresh();setNotice('기존 링크를 폐기하고 새 링크를 만들었어요. 다시 공유해주세요.');})}/>{request.inviteEnabled!==false&&<Button label="새로운 참여 중지" disabled={task.busy} onPress={()=>void task.run(async()=>{await repo.manageInvite(request,store.userId,false);await store.refresh();setNotice('기존 링크로 새로 참여할 수 없어요.');})}/>}<Button label="셀렉과 서버 사진 삭제" onPress={()=>setAction('delete')}/></>}
 </>}
 {action==='report'&&<>
  <Text style={styles.muted}>{photoId?'현재 사진':'이 셀렉'}을 신고해요. 신고자와 신고 내용은 다른 참여자에게 보이지 않아요.</Text>
  {!photoId&&<><Text style={styles.badge}>신고 대상</Text><Button label={target?'셀렉 전체':'✓ 셀렉 전체'} onPress={()=>setTarget('')}/>{peers.map(peer=><Button key={peer.userId} label={`${target===peer.userId?'✓ ':''}${peer.nickname}`} onPress={()=>setTarget(peer.userId)}/>)}</>}
  {Object.entries(reportReasons).map(([value,label])=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:reason===value}} onPress={()=>setReason(value as ReportReason)} style={[styles.button,reason===value&&{backgroundColor:'#eee4da'}]}><Text style={styles.text}>{reason===value?'✓ ':''}{label}</Text></Pressable>)}
  <Field label="추가 설명 · 선택" value={details} onChange={setDetails} multiline maxLength={500}/>
  <Button label="신고 보내기" primary disabled={task.busy} onPress={()=>void task.run(async()=>{await repo.reportContent(request,store.userId,photoId,photoId?request.ownerId:target||null,reason,details);setDetails('');setNotice(cloudEnabled?'신고를 접수했어요. 운영자가 확인해 조치해요.':'로컬 테스트 신고를 기록했어요. 운영자에게 전송되지는 않아요.');setAction('menu');})}/>
 </>}
 {action==='block'&&<><Text style={styles.text}>서로의 셀렉에 참여하거나 사진을 볼 수 없어요. 내가 올린 사진은 계속 관리하고 삭제할 수 있어요. 이미 사진 앱에 저장한 사본은 지울 수 없어요.</Text><Button label="차단하기" primary disabled={task.busy} onPress={()=>void task.run(async()=>{await repo.blockUser(request,store.userId,target);await store.refresh();setOpen(false);router.replace('/');})}/></>}
 {action==='delete'&&<><Text style={styles.text}>친구도 더 이상 이 셀렉을 볼 수 없어요. 서버의 원본·미리보기와 선택 기록을 삭제해요. 사진 앱에 저장한 사진은 남아 있어요. 되돌릴 수 없어요.</Text><Button label="셀렉 삭제" primary disabled={task.busy} onPress={()=>void task.run(async()=>{const result=await repo.deleteRequest(request,store.userId);await store.refresh();if(result.pending){setNotice('접근을 중지하고 삭제를 접수했어요. 서버의 대기 작업이 나머지를 정리해요.');setAction('menu');}else{setOpen(false);router.replace('/');}})}/></>}
 {!!notice&&<Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}<TaskState {...task}/>
 <Button label={action==='menu'?'닫기':'취소'} disabled={task.busy} onPress={()=>{if(action==='menu'){setOpen(false);if(notice.includes('삭제'))router.replace('/');}else setAction('menu');}}/>
 </ScrollView></SafeAreaView></View></Modal></>;
}
