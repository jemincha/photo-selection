import {router} from 'expo-router';
import {Modal,Pressable,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Request} from './domain';
import {selectionSummary,submitSelection} from './domain';
import {useStore} from './store';
import * as repo from './repository';
import {PhotoGroups} from './photo-groups';
import {Button,styles,TaskState,useTask} from './ui';

export function SelectionSheet({request,onClose,onPhoto}:{request:Request;onClose:()=>void;onPhoto:(id:string)=>void}){
 const store=useStore(),task=useTask(),submitted=!!request.submissions?.some(s=>s.userId===store.userId),summary=selectionSummary(request,store.userId),locked=request.status==='confirmed';
 return <Modal visible transparent animationType="slide" onRequestClose={()=>{if(!task.busy)onClose()}}><View style={{flex:1,backgroundColor:'#0006',justifyContent:'flex-end'}}><Pressable style={{flex:1}} disabled={task.busy} accessibilityRole="button" accessibilityLabel="분류별 보기 닫기" onPress={onClose}/><SafeAreaView accessibilityViewIsModal style={{height:'85%',backgroundColor:'#fcfbf8',borderTopLeftRadius:28,borderTopRightRadius:28}} edges={['bottom']}>
 <PhotoGroups request={request} userId={store.userId} onPhoto={photo=>{onClose();onPhoto(photo.id)}} header={<View style={{gap:12}}><View style={[styles.row,{justifyContent:'space-between'}]}><Text style={styles.title}>{locked?'내 선택 기록':submitted?'내 선택을 전했어요.':'분류한 사진 모아보기'}</Text><Button label="닫기" disabled={task.busy} onPress={onClose}/></View><Text style={styles.muted}>{locked?'분류는 읽기 전용이에요.':submitted?'사진을 눌러 다시 분류하면 제출이 해제돼요. 수정 후 다시 완료해주세요.':`사진을 누르면 돌아가서 수정할 수 있어요. 미분류 ${summary.remaining.length}장`}</Text><TaskState {...task}/></View>}/>
 <View style={styles.footer}>{submitted||locked?<Button primary label="내 보관함으로" disabled={task.busy} onPress={()=>{onClose();router.replace('/')}}/>:<Button primary label={summary.remaining.length?`미분류 ${summary.remaining.length}장 이어하기`:'골라주기 완료'} disabled={task.busy||!request.photos.length} onPress={()=>{if(summary.remaining.length){onClose();onPhoto(summary.remaining[0].id)}else void task.run(async()=>{await repo.submit(request,store.userId);store.updateRequest(request.id,current=>current.status==='selecting'?submitSelection(current,store.userId):current);})}}/>}</View>
 </SafeAreaView></View></Modal>;
}
