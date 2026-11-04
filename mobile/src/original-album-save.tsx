import {useEffect,useRef,useState} from 'react';
import {Linking,Platform,Text,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {File,Paths} from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import type {Request} from './domain';
import {saveAlbum} from './save-album';
import type {AlbumSaveState} from './save-album';
import {originalUrl} from './repository';
import {verifyOriginal} from './verify-original';
import {resolvePhotoAsset} from './resolve-photo-asset';
import {Button,styles,TaskState,useTask} from './ui';

export function OriginalAlbumSave({request,userId,autoSave=false,photoIds=request.selectedIds}:{request:Request;userId:string;autoSave?:boolean;photoIds?:string[]}){
 const key=`seollek-album-save:${userId}:${request.id}`,task=useTask(),journal=useRef<AlbumSaveState>({assets:{}}),started=useRef(false);
 const [ready,setReady]=useState(false),[saved,setSaved]=useState(0),[denied,setDenied]=useState(false),[failures,setFailures]=useState<string[]>([]),[loadError,setLoadError]=useState('');
 const photos=photoIds.map(id=>request.photos.find(p=>p.id===id)).filter((p):p is Request['photos'][number]=>!!p),albumName=`설렉 · ${request.title.slice(0,35)} · ${request.id.slice(0,6)}`;
 const completed=saved;
 useEffect(()=>{let active=true;AsyncStorage.getItem(key).then(raw=>{
  if(!active)return;
  const value=raw?JSON.parse(raw):{assets:{}};
  if(!value||typeof value.assets!=='object'||value.assets===null||Array.isArray(value.assets)||Object.values(value.assets).some((entry:unknown)=>!entry||typeof entry!=='object'||typeof (entry as {assetId?:unknown}).assetId!=='string'||typeof (entry as {inAlbum?:unknown}).inAlbum!=='boolean'))throw new Error('저장 기록을 읽지 못했어요. 중복 저장을 피하려면 다시 열어주세요.');
  journal.current=value;setSaved(photos.filter(p=>value.assets[p.id]?.inAlbum).length);setReady(true);
 }).catch(e=>{if(active)setLoadError(String(e.message||e))});return()=>{active=false};},[key]); // eslint-disable-line react-hooks/exhaustive-deps
 const save=()=>void task.run(async()=>{
  if(!ready||Platform.OS==='web')return;
  const permission=await MediaLibrary.requestPermissionsAsync(false,['photo']);setDenied(!permission.granted);
  if(!permission.granted)throw new Error('원본을 별도 앨범에 모으려면 사진 접근 권한이 필요해요.');
  const found=await MediaLibrary.getAlbumAsync(albumName);
  const rawAssets=await AsyncStorage.getItem(`seollek-photo-assets:${userId}:${request.id}`);
  let assetIds:Record<string,string>={};
  try{const value=rawAssets?JSON.parse(rawAssets):{};if(value&&typeof value==='object'&&!Array.isArray(value))assetIds=value;}catch{/* The uploaded original remains available without a local asset map. */}
  // The user may have deleted the album since the previous save.
  if(journal.current.albumId&&found?.id!==journal.current.albumId){journal.current.albumId=found?.id;for(const entry of Object.values(journal.current.assets))entry.inAlbum=false;}
  const persist=async(value:AlbumSaveState)=>{await AsyncStorage.setItem(key,JSON.stringify(value));setSaved(photos.filter(p=>value.assets[p.id]?.inAlbum).length);};
  const failed=await saveAlbum(photos,journal.current,{
   findAlbum:async()=>found?.id,
   createAsset:async photo=>resolvePhotoAsset(photo,Platform.OS==='ios'&&typeof assetIds[photo.id]==='string'?assetIds[photo.id]:undefined,{
    read:assetId=>MediaLibrary.getAssetInfoAsync(assetId,{shouldDownloadFromNetwork:false}),verify:verifyOriginal,
    create:async()=>{
    const url=await originalUrl(photo);let downloaded:File|undefined;
    try{const uri=url.startsWith('file:')?url:(downloaded=await File.downloadFileAsync(url,new File(Paths.cache,photo.filename),{idempotent:true})).uri;await verifyOriginal(uri,photo);return (await MediaLibrary.createAssetAsync(uri)).id;}
    finally{if(downloaded?.exists)downloaded.delete();}
   }}),
   createAlbum:async assetId=>(await MediaLibrary.createAlbumAsync(albumName,assetId,false)).id,
   addToAlbum:async(assetId,albumId)=>{await MediaLibrary.addAssetsToAlbumAsync([assetId],albumId,false);},persist,
  });
  setFailures(failed);if(failed.length)throw new Error(`${failed.length}장 저장을 마치지 못했어요. 완료한 사진은 건너뛰고 다시 시도해요.`);
 });
 useEffect(()=>{if(autoSave&&ready&&!started.current){started.current=true;save();}},[autoSave,ready]); // eslint-disable-line react-hooks/exhaustive-deps
 if(Platform.OS==='web')return <Text style={styles.muted}>최종 사진을 보관했어요. 사진 앱의 별도 앨범 저장은 iPhone 앱에서 제공해요.</Text>;
 return <View style={{gap:12}}><Text style={styles.subtitle}>원본을 사진 앱에 모아요</Text><Text style={styles.muted}>{albumName}</Text><Text accessibilityLiveRegion="polite" style={styles.text}>{saved} / {photos.length}장 앨범 저장 완료</Text><TaskState busy={task.busy} error={loadError||task.error}/>{failures.map(name=><Text key={name} style={styles.muted}>{name}</Text>)}<Button primary label={completed===photos.length?'앨범에 모두 저장했어요':task.error?'남은 원본 저장 다시 시도':'원본 앨범에 저장'} disabled={!ready||task.busy||completed===photos.length} onPress={save}/>{denied&&<Button label="사진 권한 설정" onPress={()=>void task.run(()=>Linking.openSettings())}/>}<Text style={styles.muted}>iPhone에 같은 원본이 남아 있으면 확인 후 앨범에 연결해요. 삭제·편집·접근 제한 등으로 연결하지 못하면 보관한 원본으로 새 저장본을 만들어요. 앨범 표시 순서는 사진 앱 설정에 따라 달라요.</Text></View>;
}
