import {useLocalSearchParams,router} from 'expo-router';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Image,KeyboardAvoidingView,Modal,PanResponder,Platform,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRequest} from '../../../request-hook';
import {Choice,choiceFor,choiceLabel} from '../../../domain';
import * as repo from '../../../repository';
import {Page,Button,Comments,styles,TaskState,useTask} from '../../../ui';

export default function Detail(){const {photoId}=useLocalSearchParams<{photoId:string}>();return <DetailContent key={photoId} initialPhoto={photoId}/>;}
function DetailContent({initialPhoto}:{initialPhoto:string}){
 const {id,store,request,locked}=useRequest(),task=useTask();
 const [current,setCurrent]=useState(initialPhoto),[showComments,setShowComments]=useState(false),[hint,setHint]=useState(false);
 const saving=useRef(false);
 useEffect(()=>{let active=true;void AsyncStorage.getItem('selection-swipe-hint').then(value=>{if(active)setHint(!value);if(!value)void AsyncStorage.setItem('selection-swipe-hint','seen').catch(()=>{})}).catch(()=>{});return()=>{active=false}},[]);
 const dismissHint=()=>{setHint(false);void AsyncStorage.setItem('selection-swipe-hint','seen').catch(()=>{})};
 const move=useCallback((delta:number)=>{if(!request||saving.current)return;setCurrent(previous=>{const idx=request.photos.findIndex(p=>p.id===previous);return request.photos[Math.max(0,Math.min(request.photos.length-1,idx+delta))]?.id||previous})},[request]);
 // PanResponder registers these callbacks; it does not invoke move or read saving during render.
 // eslint-disable-next-line react-hooks/refs
 const gestures=useMemo(()=>PanResponder.create({onMoveShouldSetPanResponder:(_e,g)=>!task.busy&&Math.abs(g.dx)>16&&Math.abs(g.dx)>Math.abs(g.dy)*1.5,onPanResponderRelease:(_e,g)=>{if(Math.abs(g.dx)>65&&Math.abs(g.dx)>Math.abs(g.dy)*1.5)move(g.dx<0?1:-1)},onPanResponderTerminationRequest:()=>true}),[move,task.busy]);
 if(!request)return <Page title="사진 불러오기"><TaskState busy={store.loading} error={store.error}/></Page>;
 const photo=request.photos.find(p=>p.id===current),idx=request.photos.findIndex(p=>p.id===current);
 if(!photo)return <Page title="사진이 없어요"><Button label="사진 목록으로" onPress={()=>router.replace(`/requests/${id}`)}/></Page>;
 const remaining=request.photos.filter(p=>!choiceFor(request,store.userId,p.id)),choice=choiceFor(request,store.userId,photo.id);
 const classify=(value:Choice)=>{if(saving.current)return;saving.current=true;void task.run(async()=>{try{await repo.react(request,store.userId,photo.id,value);await store.refresh();setCurrent(previous=>previous===photo.id?request.photos[Math.min(idx+1,request.photos.length-1)].id:previous)}finally{saving.current=false}})};
 return <SafeAreaView style={detail.page} edges={['bottom','left','right']}>
  <View style={detail.top}><Text accessibilityRole="header" style={detail.counter}>{idx+1} <Text style={styles.muted}>/ {request.photos.length}</Text></Text><Text style={styles.badge}>{locked?'최종 확정됨':`${request.photos.length-remaining.length}장 분류 완료`}</Text><Pressable accessibilityRole="button" accessibilityLabel="사진 의견 열기" onPress={()=>setShowComments(true)} style={detail.smallButton}><Text style={styles.buttonText}>의견{request.comments.filter(c=>c.photoId===photo.id).length?` ${request.comments.filter(c=>c.photoId===photo.id).length}`:''}</Text></Pressable></View>
  <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:request.photos.length,now:request.photos.length-remaining.length}} style={detail.track}><View style={[detail.progress,{width:`${(request.photos.length-remaining.length)/request.photos.length*100}%`}]}/></View>
  <View {...gestures.panHandlers} accessible accessibilityLabel={`사진 ${idx+1}, ${choice?choiceLabel[choice]:'미분류'}`} accessibilityActions={[{name:'increment',label:'다음 사진'},{name:'decrement',label:'이전 사진'}]} onAccessibilityAction={event=>move(event.nativeEvent.actionName==='increment'?1:-1)} style={detail.canvas}><Image source={{uri:photo.thumbnail}} accessibilityLabel={`사진 ${idx+1}, ${choice?choiceLabel[choice]:'미분류'}`} resizeMode="contain" style={detail.image}/></View>
  <View style={detail.bottom}>
   {hint&&!locked&&<Pressable accessibilityRole="button" accessibilityLabel="스와이프 안내 닫기" onPress={dismissHint}><Text style={detail.hint}>좌우로 넘겨 확인 · 분류하면 다음 사진으로 이동   ×</Text></Pressable>}
   <Text accessibilityLiveRegion="polite" style={detail.status}>{task.busy?'선택 저장 중…':choice?`내 선택 · ${choiceLabel[choice]}`:locked?'좌우로 사진을 확인해요':'이 사진은 어때요?'}</Text>
   {!!task.error&&<Text accessibilityRole="alert" style={detail.error}>{task.error} 다시 분류 버튼을 눌러주세요.</Text>}
   {!locked&&<View style={detail.choices}>{(['dislike','unsure','like'] as Choice[]).map((value,index)=><Pressable key={value} accessibilityRole="button" accessibilityLabel={choiceLabel[value]} accessibilityState={{selected:choice===value,disabled:task.busy}} disabled={task.busy} onPress={()=>classify(value)} style={[detail.choice,choice===value&&detail.active,task.busy&&styles.disabled]}><Text style={[detail.symbol,choice===value&&detail.white]}>{['−','~','♡'][index]}</Text><Text style={[styles.buttonText,choice===value&&detail.white]}>{choiceLabel[value]}{choice===value?' ✓':''}</Text></Pressable>)}</View>}
   {!locked&&(idx===request.photos.length-1||!remaining.length)&&<Button label={remaining.length?`아직 안 고른 ${remaining.length}장 이어하기`:'내 조합 확인하기'} primary disabled={task.busy} onPress={()=>{if(saving.current)return;if(remaining.length)setCurrent(remaining[0].id);else router.push(`/requests/${id}/review`)}}/>}
  </View>
  <Modal visible={showComments} animationType="slide" transparent onRequestClose={()=>setShowComments(false)}><KeyboardAvoidingView style={detail.scrim} behavior={Platform.OS==='ios'?'padding':Platform.OS==='android'?'height':undefined}><Pressable accessibilityRole="button" accessibilityLabel="의견 닫기" style={{flex:1}} onPress={()=>setShowComments(false)}/><SafeAreaView style={detail.sheet} edges={['bottom']}><View style={detail.top}><Text style={styles.subtitle}>사진 {idx+1} 의견</Text><Button label="닫기" onPress={()=>setShowComments(false)}/></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20}}><Comments key={photo.id} request={request} photoId={photo.id}/></ScrollView></SafeAreaView></KeyboardAvoidingView></Modal>
 </SafeAreaView>;
}
const detail=StyleSheet.create({page:{flex:1,minHeight:0,backgroundColor:'#faf9f6',width:'100%',maxWidth:760,alignSelf:'center'},top:{paddingHorizontal:18,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},counter:{fontSize:24,fontWeight:'700',color:'#252a27'},smallButton:{padding:12},track:{height:3,backgroundColor:'#e6e8e1'},progress:{height:3,backgroundColor:'#344f42'},canvas:{flex:1,minHeight:0,margin:12,backgroundColor:'#e9ebe5',borderRadius:18,overflow:'hidden'},image:{width:'100%',height:'100%'},bottom:{paddingHorizontal:16,paddingBottom:12,gap:10},status:{textAlign:'center',fontSize:13,color:'#344f42'},hint:{textAlign:'center',fontSize:12,color:'#717670',paddingVertical:4},choices:{flexDirection:'row',gap:10},choice:{flex:1,paddingVertical:12,borderWidth:1,borderColor:'#d8ddd3',backgroundColor:'white',borderRadius:18,alignItems:'center',gap:4},active:{backgroundColor:'#344f42',borderColor:'#344f42'},symbol:{fontSize:24,color:'#344f42'},white:{color:'white'},error:{fontSize:13,color:'#a34226',textAlign:'center'},scrim:{flex:1,backgroundColor:'#0006',justifyContent:'flex-end'},sheet:{maxHeight:'75%',backgroundColor:'#faf9f6',borderTopLeftRadius:24,borderTopRightRadius:24}});
