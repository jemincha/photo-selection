import {useEffect,useState} from 'react';
import type {ComponentRef,RefObject} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useBottomTabBarHeight} from 'expo-router/js-tabs';
import {Button,styles,TaskState,useTask} from './ui';

export function Coachmarks({anchor,userId}:{anchor:RefObject<ComponentRef<typeof View>|null>;userId:string}){
 const [step,setStep]=useState<number|null>(null),[target,setTarget]=useState({x:0,y:0,width:0,height:0});
 const screen=useWindowDimensions(),tabHeight=useBottomTabBarHeight(),task=useTask(),key=`seollek-coachmarks-v1:${userId}`;
 useEffect(()=>{let active=true;void AsyncStorage.getItem(key).then(seen=>{if(active&&!seen)anchor.current?.measureInWindow((x,y,width,height)=>{if(active){setTarget({x,y,width,height});setStep(0);}});}).catch(()=>{});return()=>{active=false;};},[anchor,key]);
 const close=()=>void task.run(async()=>{await AsyncStorage.setItem(key,'done');setStep(null);});
 if(step===null)return null;
 const rect=step===0?target:{x:0,y:screen.height-tabHeight,width:screen.width,height:tabHeight};
 const top=Math.max(0,rect.y-5),bottom=Math.min(screen.height,rect.y+rect.height+5);
 return <Modal transparent animationType="fade" onRequestClose={close}><View style={{flex:1}} accessibilityViewIsModal>
  <View style={[coach.shade,{top:0,left:0,right:0,height:top}]}/><View style={[coach.shade,{top:bottom,bottom:0,left:0,right:0}]}/><View style={[coach.shade,{top,left:0,width:Math.max(0,rect.x-5),height:bottom-top}]}/><View style={[coach.shade,{top,left:rect.x+rect.width+5,right:0,height:bottom-top}]}/>
  <View style={{position:'absolute',left:Math.max(0,rect.x-5),top,width:Math.min(screen.width,rect.width+10),height:bottom-top,borderWidth:2,borderColor:'#e3bb95',borderRadius:16}} pointerEvents="none"/>
  <ScrollView style={[coach.card,{bottom:screen.height-top+16,maxHeight:Math.max(120,top-40)}]} contentContainerStyle={{padding:20,gap:14}}><Text style={styles.badge}>{step+1} / 2</Text><Text accessibilityRole="header" style={styles.subtitle}>{step===0?'사진부터 올려보세요':'함께 고르고, 다시 찾아봐요'}</Text><Text style={styles.text}>{step===0?'사진을 올리면 이벤트가 생겨요. 친구에게 초대 링크를 보내고, 친구의 투표를 보며 내 사진을 최종 선택해요.':'친구는 다음 이벤트에 바로 초대해요. 끝난 이벤트는 보관함에서, 닉네임과 문의·계정 관리는 설정에서 찾아요.'}</Text><TaskState {...task}/><Button label={step===0?'다음':'시작하기'} primary disabled={task.busy} onPress={()=>{if(step===0)setStep(1);else close();}}/><Pressable accessibilityRole="button" disabled={task.busy} onPress={close} style={{padding:12,alignItems:'center'}}><Text style={styles.muted}>건너뛰기</Text></Pressable></ScrollView>
 </View></Modal>;
}
const coach=StyleSheet.create({shade:{position:'absolute',backgroundColor:'#000a'},card:{position:'absolute',left:20,right:20,maxWidth:440,alignSelf:'center',borderRadius:20,backgroundColor:'#fcfbf8'}});
