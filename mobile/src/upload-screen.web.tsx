import {useEffect,useState,useSyncExternalStore} from 'react';
import {router} from 'expo-router';
import {Image,Text,View} from 'react-native';
import {randomId} from './id';
import {useRequest} from './request-hook';
import * as repo from './repository';
import {photoFileUrl} from './photo-storage';
import {UploadQueue} from './upload-queue';
import type {UploadItem,UploadTransport} from './upload-queue';
import {queueStorage} from './upload-queue-storage';
import {pickWebFiles} from './pick-web-files';
import type {UploadStage} from './upload-error';
import {Page,Button,styles,useTask,TaskState} from './ui';

const queues=new Map<string,UploadQueue>();
let processing=Promise.resolve();
const labels:Record<UploadStage,string>={queue:'선택한 파일 임시 보관 중',read:'사진 파일 확인 중',hash:'원본 검증 중',preview:'미리보기 준비 중',store:'사진 보관 중',transfer:'사진 전송 중'};
function getQueue(scope:string){let queue=queues.get(scope);if(!queue){queue=new UploadQueue(queueStorage(scope));queues.set(scope,queue)}return queue;}
function seconds(ms:number){return `${(ms/1000).toFixed(1)}초`;}
function itemFor(file:File):UploadItem{
 const mime=file.type||({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',heic:'image/heic',heif:'image/heif',webp:'image/webp'}[file.name.split('.').pop()?.toLowerCase()||'']||'');
 if(!['image/jpeg','image/png','image/heic','image/heif','image/webp'].includes(mime))throw new Error(`${file.name}: JPEG·PNG·HEIC·WebP 사진을 선택해주세요.`);
 if(!file.size||file.size>25*1024*1024)throw new Error(`${file.name}: 비어 있지 않은 25MB 이하 사진을 선택해주세요.`);
 return {id:randomId(),filename:file.name,mime,bytes:file.size,file,status:'waiting',durations:{}};
}
export default function Upload(){const context=useRequest();if(!context.request)return <Page title="사진 준비"><TaskState busy={context.store.loading} error={context.store.error}/></Page>;if(!context.owner||context.locked)return <Page title="사진 추가"><Text style={styles.text}>셀렉 중인 내 요청에만 사진을 추가할 수 있어요.</Text><Button label="요청으로" onPress={()=>router.replace(`/requests/${context.id}`)}/></Page>;return <WebUpload key={`${context.id}:${context.store.userId}`} context={context}/>;}
function WebUpload({context}:{context:ReturnType<typeof useRequest>}){
 const {id,store,request}=context,picker=useTask();const [queue]=useState(()=>getQueue(`${store.userId}:${id}`)),[details,setDetails]=useState(false),[pickerTime,setPickerTime]=useState<number|null>(null);
 const state=useSyncExternalStore(queue.subscribe,queue.getSnapshot,queue.getSnapshot);
 useEffect(()=>{void queue.load()},[queue]);
 const busy=state.busy||picker.busy;
 useEffect(()=>{if(!busy)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[busy]);
 const transport:UploadTransport=(item,onStage)=>{
  let result:Awaited<ReturnType<UploadTransport>>;
  // Also serialize uploads from different request screens in this browser tab.
  const pending=processing.catch(()=>{}).then(async()=>{const latest=await repo.loadRequest(id);const photo=await repo.upload(latest,store.userId,{uri:'',width:0,height:0,type:'image',mimeType:item.mime,file:item.file,fileName:item.filename,fileSize:item.bytes},item.id,onStage);if(photo?.thumbnail.startsWith('photo-file:'))result={thumbnail:await photoFileUrl(photo.thumbnail)};});
  processing=pending;return pending.then(()=>result);
 };
 const pick=()=>void picker.run(async()=>{const start=Date.now(),files=await pickWebFiles();setPickerTime(Date.now()-start);if(files.length){await queue.add(files.map(itemFor),transport);await store.refresh()}});
 const resume=()=>void picker.run(async()=>{await queue.resume(transport);await store.refresh()});
 const done=state.items.filter(item=>item.status==='done'),remaining=state.items.filter(item=>item.status!=='done'),missing=remaining.filter(item=>!item.file),complete=state.items.length>0&&!remaining.length;
 const primary=missing.length?'중단된 사진 다시 선택':remaining.length?'남은 사진 이어서 준비하기':complete?'사진 셀렉 시작하기':'사진 선택하고 추가하기';
 return <Page title={complete?'사진 준비 완료':'함께 고를 사진을 추가해요'} footer={<Button label={busy?'사진 준비 중…':primary} primary disabled={busy||!state.ready} onPress={()=>{if(missing.length||!state.items.length)pick();else if(remaining.length)resume();else router.replace({pathname:'/requests/[id]/photo',params:{id,photoId:state.items[0]?.id}})}}/>}>
  <Text style={styles.muted}>{state.items.length?`${done.length} / ${state.items.length}장 완료`:'선택한 목록을 먼저 보관하고 한 장씩 준비해요. 최대 30장.'}</Text>
  {state.restored&&<Text style={styles.text}>중단된 목록을 복원했어요. 이미 완료한 사진은 건너뛰고 이어서 준비할 수 있어요.</Text>}
  {picker.busy&&!state.busy&&<Text style={styles.muted}>사진 보관함에서 파일이 전달되기를 기다리고 있어요. iCloud 사진이면 원본 다운로드 시간이 포함될 수 있어요.</Text>}
  <TaskState busy={busy||!state.ready} error={picker.error||state.error}/><TaskState busy={false} error={store.error}/>
  {state.items.map((item,index)=>{const thumbnail=item.thumbnail||request?.photos.find(photo=>photo.id===item.id)?.thumbnail;return <View key={item.id} style={[styles.card,{padding:12}]}><View style={styles.row}>{thumbnail?<Image source={{uri:thumbnail}} style={{width:64,height:64,borderRadius:10,backgroundColor:'#e6e8e1'}} resizeMode="cover" accessibilityLabel={`추가한 사진 ${index+1}`}/>:<View style={{width:64,height:64,borderRadius:10,backgroundColor:'#e6e8e1',alignItems:'center',justifyContent:'center'}}><Text style={styles.muted}>{index+1}</Text></View>}<View style={{flex:1,gap:4}}><Text style={styles.text} numberOfLines={1}>{item.filename}</Text><Text accessibilityLiveRegion="polite" style={styles.badge}>{item.status==='done'?'✓ 준비 완료':item.status==='failed'?(!item.file?'파일 다시 선택 필요':'다시 시도해주세요'):item.status==='processing'?labels[item.stage||'queue']:'차례를 기다리고 있어요'}</Text></View></View>{item.error&&<Text style={styles.muted}>{details?item.error:!item.file?'임시 보관 전에 중단됐어요. 같은 사진을 다시 선택하면 기존 목록에 연결해요.':'이 사진을 준비하지 못했어요. 오류 상세를 확인하고 다시 시도해주세요.'}</Text>}{details&&<><Text style={styles.muted}>{item.mime} · {(item.bytes/1024/1024).toFixed(1)}MB</Text><Text style={styles.muted}>{Object.entries(item.durations).map(([stage,time])=>`${labels[stage as UploadStage]} ${seconds(time)}`).join(' · ')}</Text></>}</View>})}
  {!!missing.length&&<Text style={styles.muted}>같은 사진을 다시 선택해주세요. 완료한 사진이 포함돼도 중복 추가하지 않아요. 목록에서 파일 이름을 확인할 수 있어요.</Text>}
  {complete&&<Button label="사진 더 추가하기" disabled={busy} onPress={pick}/>}
  <Button label={details?'자세한 안내 접기':'처리 시간 · 사진 준비 도움말'} onPress={()=>setDetails(!details)}/>
  {details&&<Text style={styles.muted}>{pickerTime!==null?`사진 보관함 대기 ${seconds(pickerTime)} (직접 고른 시간과 iOS 파일 전달 시간이 함께 포함돼요).\n`:''}이 브라우저에 임시 보관된 사진은 같은 주소에서 다시 열면 복원해요. 파일 보관 전에 중단된 사진은 다시 선택해야 해요. 원본 형식과 품질은 유지하고, 미리보기만 작게 만들어요. HEIC 처리는 Safari 지원 여부에 따라 달라요.</Text>}
  <Button label={complete?'사진 목록 · 친구 초대':'사진 목록으로'} disabled={busy} onPress={()=>router.replace(`/requests/${id}`)}/>
  {busy&&<Text style={styles.muted}>준비하는 동안 화면을 유지해주세요. 중단되면 같은 주소에서 목록을 이어갈 수 있어요.</Text>}
 </Page>;
}
