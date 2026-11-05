import {useRef,useState} from 'react';
import type {ComponentRef} from 'react';
import {Coachmarks} from './coachmarks';
import {router} from 'expo-router';
import {Platform,Pressable,Text,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {useStore} from './store';
import {albumCover} from './domain';
import {eventArchived,eventKind} from './event-domain';
import * as repo from './repository';
import {pickWebFiles} from './pick-web-files';
import {pendingPhotos} from './pending-photos';
import {Page,Button,PhotoImage,styles,TaskState,useTask} from './ui';

export default function Home(){
 const [picking,setPicking]=useState(false);
 const store=useStore(),task=useTask(),createAnchor=useRef<ComponentRef<typeof View>|null>(null);
 const events=store.albums.filter(a=>a.members.some(m=>m.userId===store.userId)&&!eventArchived(a,store.requests)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const start=()=>void task.run(async()=>{
  const selection:Parameters<typeof pendingPhotos.set>[1]={};
  if(Platform.OS==='web'){selection.web=await pickWebFiles();if(!selection.web.length)return;if(selection.web.length>100)throw new Error('한 번에 최대 100장까지 선택해주세요.');for(const file of selection.web)if(!file.size||file.size>25*1024*1024)throw new Error('사진은 한 장당 25MB 이하로 골라주세요.');}
  else{setPicking(true);let result:ImagePicker.ImagePickerResult;try{result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,allowsEditing:false,selectionLimit:100,quality:1,preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current});}finally{setPicking(false);}if(result.canceled||!result.assets.length)return;selection.native=result.assets;}
  const id=await repo.createEvent(store.userId,store.name);pendingPhotos.set(id,selection);await store.refresh();router.push(`/requests/${id}/upload`);
 });
 return <Page title="설렉." subtitle="함께한 설렘을 셀렉" fill topInset bottomInset={false} footer={<View ref={createAnchor} collapsable={false}><Button label={task.busy?'사진을 준비하고 있어요…':'+ 사진 올려 이벤트 만들기'} primary disabled={task.busy} onPress={start}/></View>}>
  <TaskState {...task}/>{picking&&<Text accessibilityLiveRegion="polite" style={styles.muted}>사진을 가져오고 있어요. iCloud에만 있는 원본은 다운로드가 필요해요. 사진 선택 화면을 닫으면 취소할 수 있어요.</Text>}<TaskState busy={false} error={store.error}/>
  {!events.length&&<View style={{flex:1,alignItems:'center',justifyContent:'center'}} accessible accessibilityLabel="설렉."><Text style={{fontSize:76,fontWeight:'900',letterSpacing:-5,color:'#252525'}}>설렉<Text style={{color:'#98604b'}}>.</Text></Text></View>}
  {events.map(event=>{const requests=store.requests.filter(r=>r.albumId===event.id),cover=albumCover(requests),count=requests.reduce((sum,r)=>sum+r.photos.length,0);return <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`${event.title}, ${count}장, ${event.members.length}명 참여`} onPress={()=>router.push(`/albums/${event.id}`)} style={[styles.card,{padding:0,borderWidth:0,overflow:'hidden',borderRadius:22}]}>{cover&&<PhotoImage photo={cover} wide/>}<View style={{padding:18,gap:7}}><Text style={[styles.badge,{color:'#98604b'}]}>{eventKind(event,requests,store.userId)}</Text><Text style={styles.subtitle}>{event.title}</Text><Text style={styles.muted}>{count}장 · {event.members.map(m=>m.nickname).join(' · ')} ↗</Text></View></Pressable>})}
  <Coachmarks anchor={createAnchor} userId={store.userId}/>
 </Page>;
}
