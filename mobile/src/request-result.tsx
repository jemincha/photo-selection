import {useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {Modal,Platform,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRequest} from './request-hook';
import {Photo,nickname,submittedLikes} from './domain';
import * as repo from './repository';
import {OriginalAlbumSave} from './original-album-save';
import {RequestShare} from './request-share';
import {RequestActions} from './request-actions';
import {Page,Button,Notice,PhotoImage,styles,TaskState,useTask} from './ui';

export default function Result(){const {id}=useLocalSearchParams<{id:string}>();return <ResultContent key={id}/>;}
function ResultContent(){
 const {id,store,request,owner,locked}=useRequest(),task=useTask(),[selected,setSelected]=useState<string[]>([]),[expanded,setExpanded]=useState<Photo|null>(null),[confirming,setConfirming]=useState(false),[autoSave,setAutoSave]=useState(false),[sharing,setSharing]=useState(false);
 if(!request)return <Page title={store.loading?'사진 불러오기':'셀렉을 열 수 없어요'}><TaskState busy={store.loading} error={store.error}/><Button label="다시 불러오기" onPress={()=>void store.refresh()}/><Button label="보관함으로" onPress={()=>router.replace('/')}/></Page>;
 const submissions=(request.submissions||[]).filter(s=>s.userId!==request.ownerId),photos=locked?request.photos.filter(p=>request.selectedIds.includes(p.id)):request.photos;
 const finish=()=>void task.run(async()=>{await repo.finalize(request,store.userId,selected);setConfirming(false);await store.refresh();setAutoSave(Platform.OS!=='web');});
 const toggle=(photoId:string)=>setSelected(ids=>ids.includes(photoId)?ids.filter(i=>i!==photoId):[...ids,photoId]);
 return <Page title={locked?'마음에 드는 순간, 이 사진으로 결정.':submissions.length?'친구들의 픽이 도착했어요.':'친구의 취향이 도착하는 중이에요.'} footer={locked?<Button label="보관함으로" primary onPress={()=>router.replace('/')}/>:owner?<Button label={`${selected.length}장 · ${Platform.OS==='web'?'이 사진으로 결정':'결정하고 원본 저장'}`} primary disabled={!selected.length||task.busy} onPress={()=>setConfirming(true)}/>:<Button label="내가 고른 사진 다시 보기" onPress={()=>router.replace({pathname:'/requests/[id]/photo',params:{id,photoId:request.photos[0]?.id}})}/> }>
  <View style={[styles.row,{justifyContent:'space-between'}]}><Text style={[styles.muted,{flex:1}]}>{request.title} · {request.photos.length}장</Text><RequestActions request={request}/></View><TaskState {...task}/><TaskState busy={false} error={store.error}/>
  {!locked&&<Text style={styles.text}>{submissions.length?`${submissions.map(s=>nickname(request,s.userId)).join(' · ')}님이 골랐어요.`:'친구에게 보내고 응답을 기다려요. 응답이 없어도 내가 고를 수 있어요.'}</Text>}
  <View style={[styles.grid,{justifyContent:'space-between'}]}>{photos.map(photo=><View key={photo.id} style={{width:'47.5%',gap:7}}><Pressable accessibilityRole="button" accessibilityLabel={`사진 ${request.photos.indexOf(photo)+1} 크게 보기`} onPress={()=>setExpanded(photo)}><PhotoImage photo={photo}/></Pressable><Text style={[styles.badge,{color:'#98604b'}]}>♡ {submittedLikes(request,photo.id)}{submissions.length>0&&submittedLikes(request,photo.id)===submissions.length?' · 모두의 픽':''}</Text>{owner&&!locked&&<Pressable accessibilityRole="checkbox" accessibilityState={{checked:selected.includes(photo.id),disabled:task.busy}} accessibilityLabel={`사진 ${request.photos.indexOf(photo)+1} 최종 후보`} disabled={task.busy} onPress={()=>toggle(photo.id)} style={[styles.button,{paddingVertical:10},selected.includes(photo.id)&&{backgroundColor:'#f1e5dd',borderColor:'#aa644d'}]}><Text style={styles.badge}>{selected.includes(photo.id)?'✓ 내 최종 후보':'최종 후보에 담기'}</Text></Pressable>}</View>)}</View>
  {locked&&owner&&<OriginalAlbumSave request={request} userId={store.userId} autoSave={autoSave}/>}
  {locked&&!owner&&<Notice>셀렉을 도와줘서 고마워요. 요청자가 최종 사진을 골랐어요.</Notice>}
  {!locked&&owner&&request.simple&&<><Button label={sharing?'공유 접기':'친구에게 다시 보내기'} onPress={()=>setSharing(!sharing)}/>{sharing&&<RequestShare request={request}/>}</>}
  <Modal visible={!!expanded||confirming} transparent animationType="slide" onRequestClose={()=>{setExpanded(null);setConfirming(false)}}><View style={{flex:1,backgroundColor:'#0006',justifyContent:'flex-end'}}><Pressable style={{flex:1}} accessibilityRole="button" accessibilityLabel="패널 닫기" onPress={()=>{setExpanded(null);setConfirming(false)}}/><SafeAreaView accessibilityViewIsModal style={{backgroundColor:'#fcfbf8',borderTopLeftRadius:26,borderTopRightRadius:26,maxHeight:'85%'}} edges={['bottom']}><ScrollView contentContainerStyle={{padding:24,gap:16}}>{expanded?<><PhotoImage photo={expanded} large/>{owner&&!locked&&<Button label={selected.includes(expanded.id)?'최종 후보에서 빼기':'최종 후보에 담기'} primary disabled={task.busy} onPress={()=>{toggle(expanded.id);setExpanded(null)}}/>}</>:<><Text style={styles.title}>{selected.length}장으로 결정할까요?</Text><Text style={styles.text}>{request.members.some(m=>m.userId!==request.ownerId&&!request.submissions?.some(s=>s.userId===m.userId))?'아직 고르는 친구가 있어요. ':''}결정하면 분류와 의견은 읽기 전용이 돼요.{Platform.OS!=='web'?' 이어서 사진 권한을 확인하고 원본을 별도 앨범에 저장해요.':''}</Text><TaskState {...task}/><Button label={Platform.OS==='web'?'이 사진으로 결정':'결정하고 원본 저장'} primary disabled={task.busy} onPress={finish}/></>}<Button label="닫기" disabled={task.busy} onPress={()=>{setExpanded(null);setConfirming(false)}}/></ScrollView></SafeAreaView></View></Modal>
 </Page>;
}
