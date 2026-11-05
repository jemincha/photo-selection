import {useState} from 'react';
import {router} from 'expo-router';
import {Modal,Platform,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {useStore,cloudEnabled} from './store';
import {albumCover} from './domain';
import * as repo from './repository';
import {pickWebFiles} from './pick-web-files';
import {pendingPhotos} from './pending-photos';
import {Page,Button,Field,PhotoImage,styles,TaskState,useTask} from './ui';

export default function Home(){
 const store=useStore(),task=useTask(),[settings,setSettings]=useState(false),[name,setName]=useState(store.name);
 const events=store.albums.filter(a=>a.members.some(m=>m.userId===store.userId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const start=()=>void task.run(async()=>{
  const selection:Parameters<typeof pendingPhotos.set>[1]={};
  if(Platform.OS==='web'){selection.web=await pickWebFiles();if(!selection.web.length)return;if(selection.web.length>100)throw new Error('한 번에 최대 100장까지 선택해주세요.');for(const file of selection.web)if(!file.size||file.size>25*1024*1024)throw new Error('사진은 한 장당 25MB 이하로 골라주세요.');}
  else{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,allowsEditing:false,selectionLimit:100,quality:1,preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current});if(result.canceled||!result.assets.length)return;selection.native=result.assets;}
  const id=await repo.createEvent(store.userId,store.name);pendingPhotos.set(id,selection);await store.refresh();router.push(`/requests/${id}/upload`);
 });
 return <Page title="설렉." topInset footer={<><Button label={task.busy?'사진을 준비하고 있어요…':'+ 사진 올려 이벤트 만들기'} primary disabled={task.busy} onPress={start}/><Text style={[styles.muted,{textAlign:'center'}]}>여행도 데이트도, 함께 찍은 사진을 한곳에.</Text></>}>
  <View style={[styles.row,{justifyContent:'space-between'}]}><Text style={{fontSize:11,letterSpacing:1.5,color:'#98604b'}}>A LITTLE HELP, A BETTER PICK.</Text><Pressable accessibilityRole="button" accessibilityLabel="설정" onPress={()=>{setName(store.name);setSettings(true)}} style={{padding:12}}><Text style={styles.badge}>설정</Text></Pressable></View>
  <Text style={{fontSize:28,lineHeight:39,color:'#252525',letterSpacing:-1}}>함께한 순간,{'\n'}사진도 한곳에.</Text>
  <TaskState {...task}/><TaskState busy={false} error={store.error}/>
  {!events.length&&<View style={[styles.card,{paddingVertical:36}]}><Text style={styles.subtitle}>어떤 순간을 함께했나요?</Text><Text style={styles.muted}>사진을 올리면 공유 이벤트가 생겨요. 각자 사진을 더하고 내 사진을 모아보세요.</Text></View>}
  {events.map(event=>{const requests=store.requests.filter(r=>r.albumId===event.id),cover=albumCover(requests),count=requests.reduce((sum,r)=>sum+r.photos.length,0);return <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`${event.title}, ${count}장, ${event.members.length}명 참여`} onPress={()=>router.push(`/albums/${event.id}`)} style={[styles.card,{padding:0,borderWidth:0,overflow:'hidden',borderRadius:22}]}>{cover&&<PhotoImage photo={cover} wide/>}<View style={{padding:18,gap:7}}><Text style={[styles.badge,{color:'#98604b'}]}>함께한 이벤트</Text><Text style={styles.subtitle}>{event.title}</Text><Text style={styles.muted}>{count}장 · {event.members.map(m=>m.nickname).join(' · ')} ↗</Text></View></Pressable>})}
  {!cloudEnabled&&<Text style={styles.muted}>로컬 테스트 · 이 기기에만 보관돼요. 다른 기기와의 공유는 서버 연결 후 사용할 수 있어요.</Text>}
  <Modal visible={settings} animationType="slide" transparent onRequestClose={()=>setSettings(false)}><View style={{flex:1,backgroundColor:'#0006',justifyContent:'flex-end'}}><Pressable accessibilityRole="button" accessibilityLabel="설정 닫기" style={{flex:1}} onPress={()=>setSettings(false)}/><SafeAreaView accessibilityViewIsModal style={{backgroundColor:'#fcfbf8',borderTopLeftRadius:26,borderTopRightRadius:26,maxHeight:'80%'}} edges={['bottom']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,gap:16}}><Text style={styles.title}>나의 설렉</Text><Field label="닉네임" value={name} onChange={setName} maxLength={20}/><Button label="닉네임 저장" disabled={task.busy||!name.trim()} onPress={()=>void task.run(async()=>{await store.setName(name);setSettings(false)})}/><Button label="개인정보와 사진 보관 안내" onPress={()=>{setSettings(false);router.push('/privacy')}}/><Button label="이용약관과 커뮤니티 기준" onPress={()=>{setSettings(false);router.push('/terms')}}/><Button label="도움과 문의" onPress={()=>{setSettings(false);router.push('/support')}}/><Button label="계정과 데이터 삭제" onPress={()=>{setSettings(false);router.push('/account-delete')}}/><TaskState {...task}/>{!cloudEnabled&&store.userId==='local-friend'&&<Button label="내 사용자로 돌아오기" onPress={()=>{store.backToMe();setSettings(false)}}/>}<Button label="닫기" onPress={()=>setSettings(false)}/></ScrollView></SafeAreaView></View></Modal>
 </Page>;
}
