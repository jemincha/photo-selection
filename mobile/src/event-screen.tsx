import {useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {Modal,Pressable,SectionList,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useStore,cloudEnabled} from './store';
import {eventSections} from './event-domain';
import type {EventPhoto} from './event-domain';
import * as repo from './repository';
import {RequestShare} from './request-share';
import {RequestActions} from './request-actions';
import {ZoomPhoto} from './zoom-photo';
import {Page,Button,Field,PhotoImage,styles,TaskState,useTask} from './ui';

export default function Event(){const {id}=useLocalSearchParams<{id:string}>();return <EventContent key={id} id={id}/>;}
function EventContent({id}:{id:string}){
 const store=useStore(),task=useTask(),[expanded,setExpanded]=useState<EventPhoto|null>(null),[editing,setEditing]=useState(false),[title,setTitle]=useState(''),[sharing,setSharing]=useState(false),[notice,setNotice]=useState('');
 const event=store.albums.find(a=>a.id===id&&a.members.some(m=>m.userId===store.userId));
 if(!event)return <Page title="공유 이벤트"><TaskState busy={store.loading} error={store.error}/><Text style={styles.muted}>이벤트를 불러올 수 없어요.</Text><Button label="다시 불러오기" onPress={()=>void store.refresh()}/><Button label="보관함으로" onPress={()=>router.replace('/')}/></Page>;
 const requests=store.requests.filter(r=>r.albumId===id),sections=eventSections(event,requests),mine=requests.filter(r=>r.ownerId===store.userId),legacy=requests.some(r=>r.simple);
 const canCollect=expanded&&expanded.uploadedBy!==store.userId,collected=expanded&&event.sectionPhotos?.some(ref=>ref.userId===store.userId&&ref.photoId===expanded.photo.id);
 const collect=()=>{if(!expanded)return;void task.run(async()=>{await repo.collectEventPhoto(event,store.userId,expanded.photo.id,!collected);await store.refresh();setNotice(collected?'내 섹션에서 뺐어요. 원래 사진은 그대로예요.':'내 섹션에 가져왔어요. 올린 사람의 사진도 그대로예요.');setExpanded(null);});};
 const add=()=>void task.run(async()=>{const requestId=await repo.createRequest(store.userId,`${store.name}의 사진`,store.name,id);await store.refresh();router.push(`/requests/${requestId}/upload`);});
 const move=(delta:number)=>{const photos=requests.flatMap(request=>request.photos.map(photo=>({photo,request,uploadedBy:request.ownerId,brought:false})));const index=photos.findIndex(item=>item.photo.id===expanded?.photo.id);setExpanded(photos[Math.max(0,Math.min(photos.length-1,index+delta))]||null);};
 const header=<View style={{gap:14,paddingTop:10}}><Text accessibilityRole="header" style={styles.title}>{event.title}</Text><Text style={styles.muted}>{event.members.map(m=>m.nickname).join(' · ')} · 사진 {requests.reduce((sum,r)=>sum+r.photos.length,0)}장</Text><Text style={styles.text}>각자 올린 사진을 보고, 내 사진은 내 섹션으로 가져와요.</Text><View style={styles.row}><Button label="이벤트 이름" onPress={()=>{setTitle(event.title);setEditing(!editing);}}/><Button label={sharing?'초대 접기':'함께할 사람 초대'} onPress={()=>setSharing(!sharing)}/></View>
  {editing&&<><Field label="이벤트 이름" value={title} onChange={setTitle} maxLength={60}/><Button label="이름 저장" disabled={task.busy||!title.trim()} onPress={()=>void task.run(async()=>{await repo.renameEvent(event,store.userId,title);await store.refresh();setEditing(false);})}/></>}
  {sharing&&<>{mine.filter(r=>r.photos.length>0).map(r=><View key={r.id} style={styles.card}><RequestShare request={r}/></View>)}{!mine.some(r=>r.photos.length)&&<Text style={styles.muted}>사진을 올린 참여자가 이벤트 초대 링크를 공유할 수 있어요.</Text>}</>}
  <TaskState {...task}/><TaskState busy={false} error={store.error}/>{!!notice&&<Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
  {cloudEnabled&&mine.some(r=>r.photos.length&&!r.publishedAt)&&<View style={styles.card}><Text style={styles.text}>새로 올린 사진을 공개하면 이벤트 참여자에게도 보여요.</Text><Button label="새 사진 공개하기" onPress={()=>setSharing(true)}/></View>}
  {legacy&&<Text style={styles.muted}>이전 셀렉 기록이에요. 사진과 선택 기록은 그대로 볼 수 있어요. 새 사진을 함께 모으려면 새 이벤트를 만들어주세요.</Text>}
 </View>;
 return <SafeAreaView style={styles.page} edges={['bottom','left','right']}><SectionList contentContainerStyle={[styles.content,{gap:0}]} sections={sections.map(section=>({...section,data:Array.from({length:Math.ceil(section.photos.length/3)},(_,i)=>section.photos.slice(i*3,i*3+3))}))} keyExtractor={row=>row[0].photo.id} stickySectionHeadersEnabled={false} initialNumToRender={6} maxToRenderPerBatch={4} windowSize={5} ListHeaderComponent={header}
  renderSectionHeader={({section})=><View style={{paddingTop:26,paddingBottom:12,gap:10}}><Text accessibilityRole="header" style={styles.subtitle}>{section.nickname}의 사진{section.userId===store.userId?' · 나':''} · {section.photos.length}장</Text>{!section.photos.length&&<Text style={styles.muted}>{section.userId===store.userId?'사진을 올리거나 다른 참여자의 사진을 내 섹션에 가져와보세요.':'아직 모은 사진이 없어요.'}</Text>}</View>}
  renderItem={({item})=><View style={[styles.row,{alignItems:'flex-start',marginBottom:14}]}>{item.map(entry=><Pressable key={entry.photo.id} accessibilityRole="button" accessibilityLabel={`${entry.photo.filename}${entry.brought?', 가져온 사진':''}`} onPress={()=>{setNotice('');setExpanded(entry);}} style={{width:'31.5%',gap:5}}><PhotoImage photo={entry.photo}/><Text style={styles.muted}>{entry.brought?`${event.members.find(m=>m.userId===entry.uploadedBy)?.nickname||'참여자'}에게서 가져옴`:'직접 올린 사진'}</Text></Pressable>)}</View>}
  ListFooterComponent={<View style={{gap:14,paddingVertical:20}}>{requests.map(r=><View key={r.id} style={styles.row}><View style={{flex:1}}><Button label={`${r.members.find(m=>m.userId===r.ownerId)?.nickname||'참여자'} · ${r.photos.length}장 ${r.status==='confirmed'?'선택 기록':'사진 고르기'}`} onPress={()=>router.push(r.photos.length?{pathname:'/requests/[id]/photo',params:{id:r.id,photoId:r.photos[0].id}}:`/requests/${r.id}/upload`)}/>{r.ownerId===store.userId&&<Button label={r.photos.length?'최종 사진 선택 · 결과':'업로드 이어하기'} onPress={()=>router.push(`/requests/${r.id}/${r.photos.length?'result':'upload'}`)}/>}</View><RequestActions request={r}/></View>)}{!cloudEnabled&&requests[0]&&<Button label={store.userId==='local-friend'?'내 사용자로 돌아오기':'테스트 친구로 이벤트 보기'} onPress={()=>void task.run(async()=>{if(store.userId==='local-friend')store.backToMe();else await store.testAsFriend(requests[0]);})}/>}</View>}/>
  <View style={styles.footer}><Button label="+ 이 이벤트에 사진 추가" primary disabled={task.busy||!store.name||legacy} onPress={add}/></View>
  <Modal visible={!!expanded} animationType="slide" onRequestClose={()=>{if(!task.busy)setExpanded(null);}}><SafeAreaView style={styles.page} edges={['top','bottom','left','right']}>{expanded&&<><View style={[styles.row,{padding:16,justifyContent:'space-between'}]}><Text style={styles.badge}>{event.members.find(m=>m.userId===expanded.uploadedBy)?.nickname}님이 올린 사진</Text><RequestActions request={expanded.request} photoId={expanded.photo.id}/><Button label="닫기" disabled={task.busy} onPress={()=>setExpanded(null)}/></View><ZoomPhoto key={expanded.photo.id} uri={expanded.photo.thumbnail} width={expanded.photo.width} height={expanded.photo.height} label={expanded.photo.filename} onMove={move}/><View style={[styles.footer,{gap:10}]}><TaskState {...task}/>{canCollect&&<Button label={collected?'내 섹션에서 빼기':'내 섹션으로 가져오기'} primary disabled={task.busy||expanded.photo.unavailable} onPress={collect}/>}<Button label="이 사진 골라보기" disabled={task.busy} onPress={()=>{setExpanded(null);router.push({pathname:'/requests/[id]/photo',params:{id:expanded.request.id,photoId:expanded.photo.id}});}}/></View></>}</SafeAreaView></Modal>
 </SafeAreaView>;
}
