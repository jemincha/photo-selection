import {useState} from 'react';
import {router} from 'expo-router';
import {Modal,Platform,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {useStore,cloudEnabled} from './store';
import {requestDestination,selectionSummary} from './domain';
import * as repo from './repository';
import {pickWebFiles} from './pick-web-files';
import {pendingPhotos} from './pending-photos';
import {Page,Button,Field,PhotoImage,styles,TaskState,useTask} from './ui';

export default function Home(){
 const store=useStore(),task=useTask(),[settings,setSettings]=useState(false),[name,setName]=useState(store.name);
 const requests=store.requests.filter(r=>r.members.some(m=>m.userId===store.userId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const start=()=>void task.run(async()=>{
  const selection:Parameters<typeof pendingPhotos.set>[1]={};
  if(Platform.OS==='web'){selection.web=await pickWebFiles();if(!selection.web.length)return;if(selection.web.length>30)throw new Error('한 번에 최대 30장까지 선택해주세요.');for(const file of selection.web)if(!file.size||file.size>25*1024*1024)throw new Error('사진은 한 장당 25MB 이하로 골라주세요.');}
  else{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,allowsEditing:false,selectionLimit:30,quality:1,preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current});if(result.canceled||!result.assets.length)return;selection.native=result.assets;}
  const id=await repo.createQuickRequest(store.userId,store.name);pendingPhotos.set(id,selection);await store.refresh();router.push(`/requests/${id}/upload`);
 });
 return <Page title="설렉." topInset footer={<><Button label={task.busy?'사진을 준비하고 있어요…':'+ 사진 골라달라고 하기'} primary disabled={task.busy} onPress={start}/><Text style={[styles.muted,{textAlign:'center'}]}>사진 고르고, 링크 하나로 부탁해요.</Text></>}>
  <View style={[styles.row,{justifyContent:'space-between'}]}><Text style={{fontSize:11,letterSpacing:1.5,color:'#98604b'}}>A LITTLE HELP, A BETTER PICK.</Text><Pressable accessibilityRole="button" accessibilityLabel="설정" onPress={()=>{setName(store.name);setSettings(true)}} style={{padding:12}}><Text style={styles.badge}>설정</Text></Pressable></View>
  <Text style={{fontSize:28,lineHeight:39,color:'#252525',letterSpacing:-1}}>뭐 올릴까?{'\n'}같이 고르면 쉬우니까.</Text>
  <TaskState {...task}/><TaskState busy={false} error={store.error}/>
  {!requests.length&&<View style={[styles.card,{paddingVertical:36}]}><Text style={styles.subtitle}>친구의 한 끗이 필요할 때</Text><Text style={styles.muted}>비슷한 사진 중 고민되는 순간, 사진만 골라 바로 부탁해요.</Text></View>}
  {requests.map(r=>{const own=r.ownerId===store.userId,summary=selectionSummary(r,store.userId),submitted=r.submissions?.some(s=>s.userId===store.userId),responses=r.submissions?.filter(s=>s.userId!==r.ownerId).length||0,cover=r.photos.find(p=>r.selectedIds.includes(p.id))||r.photos[0],label=r.status==='confirmed'?'최종 사진 보기':own?(r.simple&&!r.publishedAt?'사진 준비 이어하기':responses?`친구 ${responses}명이 골랐어요 · 결과 보기`:'친구 선택 기다리는 중'):submitted?'내가 고른 조합 보기':`사진 골라주기 · ${summary.remaining.length}장 남음`;return <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${r.title}, ${label}`} onPress={()=>router.push(requestDestination(r,store.userId) as Parameters<typeof router.push>[0])} style={[styles.card,{padding:0,borderWidth:0,overflow:'hidden',borderRadius:22}]}>{cover&&<PhotoImage photo={cover} wide/>}<View style={{padding:18,gap:7}}><Text style={[styles.badge,{color:'#98604b'}]}>{own?'내가 보낸 셀렉':'친구의 부탁'}</Text><Text style={styles.subtitle}>{r.title}</Text><Text style={styles.muted}>{r.photos.length}장 · {label} ↗</Text></View></Pressable>})}
  {!cloudEnabled&&<Text style={styles.muted}>로컬 테스트 · 이 브라우저에만 보관돼요. 다른 기기와의 공유는 서버 연결 후 사용할 수 있어요.</Text>}
  <Modal visible={settings} animationType="slide" transparent onRequestClose={()=>setSettings(false)}><View style={{flex:1,backgroundColor:'#0006',justifyContent:'flex-end'}}><Pressable accessibilityRole="button" accessibilityLabel="설정 닫기" style={{flex:1}} onPress={()=>setSettings(false)}/><SafeAreaView accessibilityViewIsModal style={{backgroundColor:'#fcfbf8',borderTopLeftRadius:26,borderTopRightRadius:26,maxHeight:'80%'}} edges={['bottom']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,gap:16}}><Text style={styles.title}>나의 설렉</Text><Field label="닉네임" value={name} onChange={setName} maxLength={20}/><Button label="닉네임 저장" disabled={task.busy||!name.trim()} onPress={()=>void task.run(async()=>{await store.setName(name);setSettings(false)})}/><Button label="개인정보와 사진 보관 안내" onPress={()=>{setSettings(false);router.push('/privacy')}}/><Button label="이용약관과 커뮤니티 기준" onPress={()=>{setSettings(false);router.push('/terms')}}/><Button label="도움과 문의" onPress={()=>{setSettings(false);router.push('/support')}}/><Button label="계정과 데이터 삭제" onPress={()=>{setSettings(false);router.push('/account-delete')}}/><TaskState {...task}/>{!cloudEnabled&&store.userId==='local-friend'&&<Button label="내 사용자로 돌아오기" onPress={()=>{store.backToMe();setSettings(false)}}/>}<Button label="닫기" onPress={()=>setSettings(false)}/></ScrollView></SafeAreaView></View></Modal>
 </Page>;
}
