import {useLocalSearchParams,router} from 'expo-router';
import {useCallback,useEffect,useRef,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Image,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ZoomPhoto} from '../../../zoom-photo';
import {PhotoPrefetch} from '../../../photo-view';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRequest} from '../../../request-hook';
import {Choice,choiceFor,choiceLabel,selectionSummary,setChoice} from '../../../domain';
import {SelectionSheet} from '../../../selection-sheet';
import {RequestActions} from '../../../request-actions';
import * as repo from '../../../repository';
import {Page,Button,Comments,styles,TaskState,useTask} from '../../../ui';

export default function Detail(){const {photoId}=useLocalSearchParams<{photoId:string}>();return <DetailContent key={photoId} initialPhoto={photoId}/>;}
function DetailContent({initialPhoto}:{initialPhoto:string}){
 const {id,store,request,locked,owner}=useRequest(),task=useTask();
 const [current,setCurrent]=useState(initialPhoto),[showComments,setShowComments]=useState(false),[hint,setHint]=useState(false),[showReview,setShowReview]=useState(false);
 const saving=useRef(false);
 const [prefetch]=useState(()=>new PhotoPrefetch(uri=>Image.prefetch(uri)));
 const index=request?.photos.findIndex(photo=>photo.id===current)??-1;
 const next=request?.photos[index+1]?.thumbnail||'',afterNext=request?.photos[index+2]?.thumbnail||'';
 useEffect(()=>{prefetch.set([next,afterNext]);return()=>prefetch.set([]);},[prefetch,next,afterNext]);
 useEffect(()=>{let active=true;void AsyncStorage.getItem('selection-swipe-hint').then(value=>{if(active)setHint(!value);if(!value)void AsyncStorage.setItem('selection-swipe-hint','seen').catch(()=>{})}).catch(()=>{});return()=>{active=false}},[]);
 const dismissHint=()=>{setHint(false);void AsyncStorage.setItem('selection-swipe-hint','seen').catch(()=>{})};
 const move=useCallback((delta:number)=>{if(!request)return;setCurrent(previous=>{const idx=request.photos.findIndex(p=>p.id===previous);return request.photos[Math.max(0,Math.min(request.photos.length-1,idx+delta))]?.id||previous})},[request]);
 if(!request)return <Page title="사진 불러오기"><TaskState busy={store.loading} error={store.error}/></Page>;
 const photo=request.photos.find(p=>p.id===current),idx=request.photos.findIndex(p=>p.id===current);
 if(!photo)return <Page title="사진이 없어요"><Button label="사진 목록으로" onPress={()=>router.replace(`/requests/${id}`)}/></Page>;
 const canVote=!owner&&!locked;
 const remaining=request.photos.filter(p=>!choiceFor(request,store.userId,p.id)),choice=choiceFor(request,store.userId,photo.id);
 const classify=(value:Choice)=>{if(!canVote||saving.current||photo.unavailable)return;saving.current=true;void task.run(async()=>{try{await repo.react(request,store.userId,photo.id,value);store.updateRequest(id,current=>current.status==='selecting'?setChoice(current,store.userId,photo.id,value):current);const latest=setChoice(request,store.userId,photo.id,value),next=selectionSummary(latest,store.userId);setCurrent(previous=>previous===photo.id?(latest.photos[idx+1]?.id||next.remaining[0]?.id||previous):previous)}catch(error){throw new Error(`사진 ${idx+1} 선택을 저장하지 못했어요. ${error instanceof Error?error.message:String(error)}`)}finally{saving.current=false}})};
 return <SafeAreaView style={detail.page} edges={['bottom','left','right']}>
  <View style={detail.top}><Text accessibilityRole="header" style={detail.counter}>{idx+1} <Text style={styles.muted}>/ {request.photos.length}</Text></Text><Text style={styles.badge}>{owner?'친구 투표 확인':locked?'최종 확정됨':`${request.photos.length-remaining.length}장 분류 완료`}</Text><RequestActions request={request} photoId={photo.id}/>{request.simple?<Button label="닫기" disabled={task.busy} onPress={()=>router.replace(locked?`/requests/${id}/result`:'/')}/>:<Pressable accessibilityRole="button" accessibilityLabel="사진 의견 열기" onPress={()=>setShowComments(true)} style={detail.smallButton}><Text style={styles.buttonText}>의견{request.comments.filter(c=>c.photoId===photo.id).length?` ${request.comments.filter(c=>c.photoId===photo.id).length}`:''}</Text></Pressable>}</View>
  <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:request.photos.length,now:request.photos.length-remaining.length}} style={detail.track}><View style={[detail.progress,{width:`${(request.photos.length-remaining.length)/request.photos.length*100}%`}]}/></View>
  <ZoomPhoto key={`${photo.id}:${photo.thumbnail}`} uri={photo.thumbnail} width={photo.width} height={photo.height} label={`사진 ${idx+1}, ${choice?choiceLabel[choice]:'미분류'}`} onMove={move}/>
  <View style={detail.bottom}><View style={[styles.row,{justifyContent:"space-between"}]}><Button label="← 이전" disabled={idx===0} onPress={()=>move(-1)}/><Button label={owner?'친구 투표 보기':'분류별 보기'} onPress={()=>{if(owner)router.replace(`/albums/${request.albumId}`);else setShowReview(true);}}/><Button label="다음 →" disabled={idx===request.photos.length-1} onPress={()=>move(1)}/></View>
   {hint&&!locked&&<Pressable accessibilityRole="button" accessibilityLabel="스와이프 안내 닫기" onPress={dismissHint}><Text style={detail.hint}>오른쪽은 다음 · 왼쪽은 이전 · 두 손가락으로 확대   ×</Text></Pressable>}
   <Text accessibilityLiveRegion="polite" style={detail.status}>{task.busy?'선택 저장 중…':owner?'내 사진은 친구의 투표를 참고해 최종 선택해요.':choice?`내 선택 · ${choiceLabel[choice]}`:locked?'좌우로 사진을 확인해요':'이 사진은 어때요?'}</Text>
   {photo.unavailable&&<Text style={detail.error}>이 기기에 미리보기 파일이 없어요. 기록은 보존돼요. 사진을 다시 선택해 새 셀렉으로 보내주세요.</Text>}
   {!!task.error&&<Text accessibilityRole="alert" style={detail.error}>{task.error} 해당 사진으로 돌아가 다시 분류해주세요.</Text>}
   {canVote&&<View style={detail.choices}>{(['dislike','unsure','like'] as Choice[]).map((value,index)=><Pressable key={value} accessibilityRole="button" accessibilityLabel={choiceLabel[value]} accessibilityState={{selected:choice===value,disabled:task.busy||photo.unavailable}} disabled={task.busy||photo.unavailable} onPress={()=>classify(value)} style={[detail.choice,choice===value&&detail.active,(task.busy||photo.unavailable)&&styles.disabled]}><Text style={[detail.symbol,choice===value&&detail.white]}>{['×','△','♡'][index]}</Text><Text style={[styles.buttonText,choice===value&&detail.white]}>{choiceLabel[value]}{choice===value?' ✓':''}</Text></Pressable>)}</View>}
   {canVote&&(idx===request.photos.length-1||!remaining.length)&&<Button label={remaining.length?`아직 안 고른 ${remaining.length}장 이어하기`:'내가 고른 조합 확인'} primary disabled={task.busy} onPress={()=>{if(saving.current)return;if(remaining.length)setCurrent(remaining[0].id);else setShowReview(true)}}/>}
  </View>
  <Modal visible={showComments} animationType="slide" transparent onRequestClose={()=>setShowComments(false)}><KeyboardAvoidingView style={detail.scrim} behavior={Platform.OS==='ios'?'padding':Platform.OS==='android'?'height':undefined}><Pressable accessibilityRole="button" accessibilityLabel="의견 닫기" style={{flex:1}} onPress={()=>setShowComments(false)}/><SafeAreaView style={detail.sheet} edges={['bottom']}><View style={detail.top}><Text style={styles.subtitle}>사진 {idx+1} 의견</Text><Button label="닫기" onPress={()=>setShowComments(false)}/></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20}}><Comments key={photo.id} request={request} photoId={photo.id}/></ScrollView></SafeAreaView></KeyboardAvoidingView></Modal>
  {owner&&<View style={detail.bottom}><Button label="이벤트에서 친구 투표 보기" onPress={()=>router.replace(`/albums/${request.albumId}`)}/>{!locked&&<Button label="최종 선택" primary onPress={()=>router.replace(`/requests/${id}/result`)}/>}</View>}
  {showReview&&<SelectionSheet request={request} onClose={()=>setShowReview(false)} onPhoto={setCurrent}/>}
 </SafeAreaView>;
}
const detail=StyleSheet.create({page:{flex:1,minHeight:0,backgroundColor:'#faf9f6',width:'100%',maxWidth:760,alignSelf:'center'},top:{paddingHorizontal:18,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},counter:{fontSize:24,fontWeight:'700',color:'#252a27'},smallButton:{padding:12},track:{height:3,backgroundColor:'#e6e8e1'},progress:{height:3,backgroundColor:'#344f42'},bottom:{paddingHorizontal:16,paddingBottom:12,gap:10},status:{textAlign:'center',fontSize:13,color:'#344f42'},hint:{textAlign:'center',fontSize:12,color:'#717670',paddingVertical:4},choices:{flexDirection:'row',gap:10},choice:{flex:1,paddingVertical:12,borderWidth:1,borderColor:'#d8ddd3',backgroundColor:'white',borderRadius:18,alignItems:'center',gap:4},active:{backgroundColor:'#344f42',borderColor:'#344f42'},symbol:{fontSize:24,color:'#344f42'},white:{color:'white'},error:{fontSize:13,color:'#a34226',textAlign:'center'},scrim:{flex:1,backgroundColor:'#0006',justifyContent:'flex-end'},sheet:{maxHeight:'75%',backgroundColor:'#faf9f6',borderTopLeftRadius:24,borderTopRightRadius:24}});
