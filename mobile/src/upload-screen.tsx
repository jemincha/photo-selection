import {useEffect,useRef,useState} from 'react';
import {router} from 'expo-router';
import {Image,Text,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {File,Paths} from 'expo-file-system';
import {pendingPhotos} from './pending-photos';
import {RequestShare} from './request-share';
import {RequestActions} from './request-actions';
import {mergeNativeSelection,restoreNativeItems} from './native-upload-state';
import type {NativeUploadItem as Item} from './native-upload-state';
import {randomId} from './id';
import {useRequest} from './request-hook';
import * as repo from './repository';
import {Page,Button,styles,useTask,TaskState} from './ui';
export default function Upload(){const {id,store,request,owner,locked}=useRequest(),task=useTask(),started=useRef('');const [items,setItems]=useState<Item[]>([]),[details,setDetails]=useState(false),[ready,setReady]=useState(false);const key=`seollek-native-upload:${store.userId}:${id}`;
 useEffect(()=>{if(!request||!owner||locked||request.publishedAt||started.current===key)return;started.current=key;void task.run(async()=>{const raw=await AsyncStorage.getItem(key);const restored=restoreNativeItems(raw);const selected=pendingPhotos.get(id)?.native;pendingPhotos.delete(id);if(selected?.length)await stage(selected,restored);else setItems(restored);setReady(true);});},[id,owner,locked,!!request]); // eslint-disable-line react-hooks/exhaustive-deps
 if(!request)return <Page title="사진 준비"><TaskState busy={store.loading} error={store.error}/></Page>;
 if(!owner||locked)return <Page title="사진 준비"><Text style={styles.text}>이미 보낸 셀렉의 사진은 바꿀 수 없어요.</Text><Button label="결과 보기" onPress={()=>router.replace(`/requests/${id}/result`)}/></Page>;
 if(request.simple&&request.publishedAt)return <Page title="링크가 준비됐어요"><Text style={styles.muted}>{request.photos.length}장 · {request.title}</Text><RequestShare request={request}/></Page>;
 const process=async(batch:Item[])=>{const all=[...batch];for(const item of all.filter(i=>i.status!=='done')){try{const latest=await repo.loadRequest(id);await repo.upload(latest,store.userId,item.asset,item.id,stage=>setItems(current=>current.map(i=>i.id===item.id?{...i,status:'processing',stage,error:undefined}:i)));item.status='done';item.error=undefined;}catch(e){item.status='failed';item.error=e instanceof Error?e.message:String(e);}await AsyncStorage.setItem(key,JSON.stringify(all));setItems([...all]);}for(const item of all.filter(i=>i.status==='done')){const staged=new File(item.asset.uri);if(staged.uri.startsWith(Paths.document.uri)&&staged.name.startsWith(`upload-${item.id}.`)&&staged.exists)staged.delete();}await store.refresh()};
 async function stage(assets:ImagePicker.ImagePickerAsset[],previous=items){
  if(!previous.some(item=>item.status!=='done')&&assets.length+request!.photos.length>30)throw new Error('셀렉 하나에는 최대 30장까지 담을 수 있어요.');
  const batch=mergeNativeSelection(previous,assets,randomId);
  await AsyncStorage.setItem(key,JSON.stringify(batch));setItems(batch);
  for(const item of batch.filter(item=>item.status!=='done')){try{const extension=item.asset.fileName?.split('.').pop()?.replace(/[^a-zA-Z0-9]/g,'')||'jpg',target=new File(Paths.document,`upload-${item.id}.${extension}`);if(!target.exists)new File(item.asset.uri).copy(target);item.asset={...item.asset,uri:target.uri};await AsyncStorage.setItem(key,JSON.stringify(batch));}catch(e){item.status='failed';item.error=`사진 임시 보관 실패: ${String(e)}`;await AsyncStorage.setItem(key,JSON.stringify(batch));}}
  setItems([...batch]);await process(batch);
 }
 const pick=()=>void task.run(async()=>{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,allowsEditing:false,selectionLimit:30,quality:1,preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current});if(result.canceled)return;await stage(result.assets)});
 const failed=items.filter(i=>i.status==='failed'),done=items.filter(i=>i.status==='done'),complete=items.length>0&&done.length===items.length;
 return <Page title={complete?'친구의 한 끗이 필요한 사진들':'함께 고를 사진을 추가해요'} footer={failed.length?<Button label={`실패한 ${failed.length}장 다시 시도`} primary disabled={task.busy} onPress={()=>void task.run(()=>process(items))}/>:complete?(request.simple?<RequestShare request={request}/>:<Button label="사진 셀렉 시작하기" primary disabled={task.busy} onPress={()=>router.replace({pathname:'/requests/[id]/photo',params:{id,photoId:request.photos[0]?.id}})}/>):<Button label={task.busy?'사진 준비 중…':'사진 선택하고 추가하기'} primary disabled={task.busy||!ready} onPress={pick}/>}>
 <View style={[styles.row,{justifyContent:'space-between'}]}><Text style={[styles.muted,{flex:1}]}>{items.length?`${done.length} / ${items.length}장 완료`:'선택하면 바로 준비를 시작해요. 셀렉당 최대 30장.'}</Text><RequestActions request={request} disabled={task.busy}/></View>
 {!ready&&!!task.error&&<Button label="사진 준비 기록 다시 읽기" disabled={task.busy} onPress={()=>void task.run(async()=>{setItems(restoreNativeItems(await AsyncStorage.getItem(key)));setReady(true);})}/>}
 <TaskState {...task}/><TaskState busy={false} error={store.error}/>
 {items.map((item,index)=><View key={item.id} style={[styles.card,{padding:12}]}><View style={styles.row}><Image source={{uri:request.photos.find(photo=>photo.id===item.id)?.thumbnail||item.asset.uri}} style={{width:64,height:64,borderRadius:10,backgroundColor:'#e6e8e1'}} resizeMode="cover" accessibilityLabel={`추가할 사진 ${index+1}`}/><View style={{flex:1,gap:4}}><Text style={styles.text}>사진 {index+1}</Text><Text accessibilityLiveRegion="polite" style={styles.badge}>{item.status==='done'?'✓ 준비 완료':item.status==='failed'?'다시 시도해주세요':item.status==='processing'?({queue:'사진 임시 보관 중',hash:'원본 검증 중',read:'사진 불러오는 중',preview:'미리보기 준비 중',store:'사진 보관 중',transfer:'사진 전송 중'}[item.stage||'read']):'차례를 기다리고 있어요'}</Text></View></View>{item.status==='failed'&&<Text style={styles.muted}>이 사진을 준비하지 못했어요. 다시 시도하거나 사진 앱에서 원본 다운로드를 확인해주세요.</Text>}{details&&<><Text style={styles.muted}>{item.asset.fileName||'선택한 사진'} · {item.asset.mimeType||'사진'} · {((item.asset.fileSize||item.asset.file?.size||0)/1024/1024).toFixed(1)}MB</Text>{item.error&&<Text style={styles.muted}>{item.error}</Text>}</>}</View>)}
 {!!failed.length&&<Text style={styles.muted}>iCloud 사진은 Wi-Fi에서 사진 앱의 원본 다운로드를 기다려주세요. 이미 완료한 사진은 다시 추가하지 않아요.</Text>}
 {!!failed.length&&<Button label="중단된 사진 다시 선택" disabled={task.busy} onPress={pick}/>}
 {complete&&<Button label="사진 더 추가하기" disabled={task.busy} onPress={pick}/>}
 <Button label={details?'자세한 안내 접기':'사진 준비 도움말 · 상세 정보'} onPress={()=>setDetails(!details)}/>
 {details&&<Text style={styles.muted}>원본 형식과 품질을 보관하고 미리보기는 따로 만들어요. 한 장 최대 25MB. HEIC/HEIF는 브라우저에서 미리보기 생성이 가능해야 해요. iCloud 사진이 잘 안 되면 원본을 내려받은 뒤 1~3장씩 시도해주세요.</Text>}
 {!request.simple&&<Button label={complete?'사진 목록 · 친구 초대':'사진 목록으로'} disabled={task.busy} onPress={()=>router.replace(`/requests/${id}`)}/>}
 {task.busy&&<Text style={styles.muted}>사진을 준비하는 동안 이 화면을 유지해주세요.</Text>}
 </Page>;
}
