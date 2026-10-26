import {useState} from 'react';
import {router} from 'expo-router';
import {Modal,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Request} from './domain';
import {selectionSummary} from './domain';
import {useStore} from './store';
import * as repo from './repository';
import {Button,PhotoImage,styles,TaskState,useTask} from './ui';

export function SelectionSheet({request,onClose,onPhoto}:{request:Request;onClose:()=>void;onPhoto:(id:string)=>void}){
 const store=useStore(),task=useTask(),[submitted,setSubmitted]=useState(!!request.submissions?.some(s=>s.userId===store.userId)),summary=selectionSummary(request,store.userId);
 return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={{flex:1,backgroundColor:'#0006',justifyContent:'flex-end'}}><Pressable style={{flex:1}} accessibilityRole="button" accessibilityLabel="고른 조합 닫기" onPress={onClose}/><SafeAreaView accessibilityViewIsModal style={{maxHeight:'80%',backgroundColor:'#fcfbf8',borderTopLeftRadius:28,borderTopRightRadius:28}} edges={['bottom']}><ScrollView contentContainerStyle={{padding:24,gap:16}}><View style={[styles.row,{justifyContent:'space-between'}]}><Text style={styles.title}>{submitted?'골라줘서 고마워요.':`좋아로 고른 ${summary.liked.length}장`}</Text><Button label="닫기" disabled={task.busy} onPress={onClose}/></View><Text style={styles.muted}>{submitted?'내 선택을 전했어요. 이 링크에서 다시 볼 수 있어요.':`좋아 ${summary.counts.like} · 글쎄 ${summary.counts.unsure} · 별로 ${summary.counts.dislike}`}</Text>{!summary.liked.length&&<Text style={styles.text}>좋아로 고른 사진이 없어도 마음을 전할 수 있어요.</Text>}<View style={styles.grid}>{summary.liked.map(photo=><Pressable key={photo.id} style={styles.tile} accessibilityRole="button" accessibilityLabel={`사진 ${request.photos.indexOf(photo)+1} 다시 보기`} onPress={()=>{onClose();onPhoto(photo.id)}}><PhotoImage photo={photo}/></Pressable>)}</View><TaskState {...task}/>{submitted?<Button primary label="내 보관함으로" onPress={()=>{onClose();router.replace('/')}}/>:<Button primary label="골라주기 완료" disabled={task.busy||!!summary.remaining.length} onPress={()=>void task.run(async()=>{await repo.submit(request,store.userId);await store.refresh();setSubmitted(true)})}/>}</ScrollView></SafeAreaView></View></Modal>;
}
