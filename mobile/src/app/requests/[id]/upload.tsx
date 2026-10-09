import {useState} from 'react';
import {router} from 'expo-router';
import {Text,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {UploadStage} from '../../../upload-error';
import {randomId} from '../../../id';
import {useRequest} from '../../../request-hook';
import * as repo from '../../../repository';
import {Page,Button,Notice,styles,useTask,TaskState} from '../../../ui';
type Item={id:string;asset:ImagePicker.ImagePickerAsset;status:'waiting'|'processing'|'done'|'failed';stage?:UploadStage;error?:string};
export default function Upload(){const {id,store,request,owner,locked}=useRequest(),task=useTask();const [items,setItems]=useState<Item[]>([]);
 if(!request)return <Page title="요청 불러오기"><TaskState busy={store.loading} error={store.error}/></Page>;
 if(!owner||locked)return <Page title="사진 업로드"><Notice>사진은 셀렉 중인 요청의 요청자만 올릴 수 있어요.</Notice><Button label="요청으로" onPress={()=>router.replace(`/requests/${id}`)}/></Page>;
 const pick=()=>void task.run(async()=>{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,allowsEditing:false,selectionLimit:30,quality:1,preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current});if(!result.canceled)setItems(result.assets.map(asset=>({id:randomId(),asset,status:'waiting'})))});
 const upload=()=>void task.run(async()=>{for(const item of items.filter(i=>i.status!=='done')){try{await repo.upload(request,store.userId,item.asset,item.id,stage=>setItems(current=>current.map(i=>i.id===item.id?{...i,status:'processing',stage,error:undefined}:i)));setItems(current=>current.map(i=>i.id===item.id?{...i,status:'done',error:undefined}:i))}catch(e){setItems(current=>current.map(i=>i.id===item.id?{...i,status:'failed',error:e instanceof Error?e.message:String(e)}:i))}}await store.refresh()});
 return <Page title="친구에게 보여줄 사진"><Notice>원본 파일과 미리보기 이미지를 따로 보관해요. 한 장 최대 25MB. HEIC/HEIF는 Safari에서 미리보기 생성이 가능한 파일을 지원해요. 원본 형식과 품질은 그대로 보관합니다.</Notice><Notice>iCloud 사진은 Wi-Fi에 연결하고 사진 앱에서 다운로드를 기다린 뒤 선택해주세요. 우선 1~3장씩 시도하면 좋아요.</Notice><Text style={styles.muted}>현재 사진 {request.photos.length}장 · 선택은 한 번에 최대 30장</Text><Button label="사진 선택" disabled={task.busy} primary onPress={pick}/><TaskState {...task}/>{items.map((item,index)=><View key={item.id} style={styles.card}><Text style={styles.text}>{index+1}. {item.asset.fileName||'선택한 사진'}</Text><Text style={styles.muted}>{item.asset.mimeType||'사진'} · {((item.asset.fileSize||item.asset.file?.size||0)/1024/1024).toFixed(1)}MB</Text><Text style={styles.badge}>{item.status==='done'?'업로드 완료':item.status==='failed'?'실패':item.status==='processing'?({read:'파일 읽는 중',preview:'미리보기 만드는 중',store:'기기에 저장 중',transfer:'서버로 전송 중'}[item.stage||'read']):'대기'}</Text>{item.error&&<Text style={styles.muted}>{item.error}</Text>}</View>)}{!!items.length&&<><Text style={styles.text}>{items.filter(i=>i.status==='done').length} / {items.length}장 완료</Text><Button label={items.some(i=>i.status==='failed')?'실패한 사진 다시 업로드':'업로드 시작'} disabled={task.busy||items.every(i=>i.status==='done')} primary onPress={upload}/></>}<Button label="사진 목록·초대로 이동" disabled={task.busy} onPress={()=>router.replace(`/requests/${id}`)}/><Text style={styles.muted}>업로드 중 화면을 유지해주세요. 실패 항목은 이 화면에서 다시 시도할 수 있어요.</Text></Page>;
}
