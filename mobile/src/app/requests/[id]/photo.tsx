import {useLocalSearchParams,router} from 'expo-router';
import {useCallback,useMemo,useState} from 'react';
import {PanResponder,Text,View} from 'react-native';
import {useRequest} from '../../../request-hook';
import {Choice,choiceFor,choiceLabel} from '../../../domain';
import * as repo from '../../../repository';
import {Page,Button,ChoiceButtons,PhotoImage,Comments,styles,TaskState,useTask} from '../../../ui';
export default function Detail(){const {photoId}=useLocalSearchParams<{photoId:string}>();return <DetailContent key={photoId} initialPhoto={photoId}/>;}
function DetailContent({initialPhoto}:{initialPhoto:string}){const {id,store,request,locked}=useRequest(),task=useTask();const [current,setCurrent]=useState(initialPhoto),[showComments,setShowComments]=useState(false);
 const move=useCallback((delta:number)=>{if(!request)return;setCurrent(previous=>{const idx=request.photos.findIndex(p=>p.id===previous);return request.photos[Math.max(0,Math.min(request.photos.length-1,idx+delta))]?.id||previous});setShowComments(false)},[request]);
 const gestures=useMemo(()=>PanResponder.create({onMoveShouldSetPanResponder:(_e,g)=>!task.busy&&Math.abs(g.dx)>16&&Math.abs(g.dx)>Math.abs(g.dy)*1.5,onPanResponderRelease:(_e,g)=>{if(Math.abs(g.dx)>65&&Math.abs(g.dx)>Math.abs(g.dy)*1.5)move(g.dx<0?1:-1)},onPanResponderTerminationRequest:()=>true}),[move,task.busy]);
 if(!request)return <Page title="사진 상세"><TaskState busy={store.loading} error={store.error}/></Page>;
 const photo=request.photos.find(p=>p.id===current),idx=request.photos.findIndex(p=>p.id===current);if(!photo)return <Page title="사진이 없어요"><Button label="목록으로" onPress={()=>router.back()}/></Page>;
 const classify=(value:Choice)=>void task.run(async()=>{await repo.react(request,store.userId,photo.id,value);await store.refresh();move(1)});
 const choice=choiceFor(request,store.userId,photo.id),remaining=request.photos.filter(p=>!choiceFor(request,store.userId,p.id));
 return <Page title={`사진 ${idx+1} / ${request.photos.length}`} footer={<>{!locked&&<><ChoiceButtons request={request} photo={photo} busy={task.busy} onChange={classify}/>{idx===request.photos.length-1&&<Button label={remaining.length?`셀렉 제출 · ${remaining.length}장 미분류`:'셀렉 제출하기'} primary disabled={task.busy||!!remaining.length} onPress={()=>void task.run(async()=>{await repo.submit(request,store.userId);await store.refresh();router.replace(`/requests/${id}/submitted`)})}/>}</>}</>}>
 <Text style={styles.muted}>분류하면 다음 사진으로 넘어가요. 수정하려면 오른쪽으로 스와이프해 이전 사진으로 돌아오세요.</Text><View {...gestures.panHandlers}><PhotoImage photo={photo} large/></View><Text style={styles.badge}>내 분류: {choice?choiceLabel[choice]:'아직 안 고름'} · 미분류 {remaining.length}장</Text>{idx===request.photos.length-1&&!locked&&<Text style={styles.muted}>마지막 사진이에요. 스와이프로 선택을 확인한 뒤 제출해주세요.</Text>}<TaskState {...task}/><Button label={showComments?'의견 접기':'의견 남기기 (선택)'} onPress={()=>setShowComments(!showComments)}/>{showComments&&<Comments key={photo.id} request={request} photoId={photo.id}/>}<Button label="사진 목록으로" onPress={()=>router.back()}/>
 </Page>;
}
