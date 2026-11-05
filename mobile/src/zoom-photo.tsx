import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Image,PanResponder,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import type {GestureResponderEvent,ViewStyle} from 'react-native';
import {boundZoom,initialZoom} from './photo-view';
import type {Zoom} from './photo-view';

export function ZoomPhoto({uri,width,height,label,onMove}:{uri:string;width:number;height:number;label:string;onMove:(delta:number)=>void}){
 const [zoom,setZoom]=useState<Zoom>(initialZoom),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 const current=useRef(initialZoom),size=useRef({width:0,height:0}),lastTap=useRef({time:0,x:0,y:0});
 const gesture=useRef({count:0,distance:1,x:0,y:0,start:initialZoom,multiple:false,zoomed:false});
 const props=useRef({width,height,onMove});
 useLayoutEffect(()=>{props.current={width,height,onMove};},[width,height,onMove]);
 const update=(value:Zoom)=>{const next=boundZoom(value,size.current,props.current);current.current=next;setZoom(next);};
 const toggle=()=>update(current.current.scale>1?initialZoom:{scale:2,x:0,y:0});
 const touches=(event:GestureResponderEvent)=>{
  const points=event.nativeEvent.touches,a=points[0],b=points[1]||a;
  return {count:points.length,x:a?(a.pageX+b.pageX)/2:0,y:a?(a.pageY+b.pageY)/2:0,distance:a?Math.max(1,Math.hypot(a.pageX-b.pageX,a.pageY-b.pageY)):1};
 };
 // PanResponder registers callbacks here; ref access happens only during gestures.
 // eslint-disable-next-line react-hooks/refs
 const responder=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponder:()=>true,
  onPanResponderGrant:event=>{const point=touches(event);gesture.current={...point,start:current.current,multiple:point.count>1,zoomed:current.current.scale>1};},
  onPanResponderMove:event=>{
   const point=touches(event),start=gesture.current;
   if(point.count>1)start.multiple=true;
   if(point.count!==start.count){gesture.current={...point,start:current.current,multiple:start.multiple,zoomed:start.zoomed};return;}
   if(point.count>1){
    const scale=Math.max(1,Math.min(4,start.start.scale*point.distance/start.distance)),ratio=scale/start.start.scale;
    update({scale,x:start.start.x*ratio+point.x-start.x,y:start.start.y*ratio+point.y-start.y});
   }else if(current.current.scale>1)update({...current.current,x:start.start.x+point.x-start.x,y:start.start.y+point.y-start.y});
  },
  onPanResponderRelease:(event,state)=>{
   const start=gesture.current;
   if(start.multiple){lastTap.current.time=0;return;}
   if(!start.zoomed&&Math.abs(state.dx)>65&&Math.abs(state.dx)>Math.abs(state.dy)*1.5){lastTap.current.time=0;props.current.onMove(state.dx>0?1:-1);return;}
   if(Math.abs(state.dx)>8||Math.abs(state.dy)>8){lastTap.current.time=0;return;}
   const {pageX:x,pageY:y}=event.nativeEvent,now=event.timeStamp,last=lastTap.current;
   if(last.time>0&&now-last.time<300&&Math.hypot(x-last.x,y-last.y)<30){toggle();lastTap.current.time=0;}else lastTap.current={time:now,x,y};
  },
  onPanResponderTerminationRequest:()=>true,
  onPanResponderTerminate:()=>{lastTap.current.time=0;},
 }),[]); // eslint-disable-line react-hooks/exhaustive-deps
 return <View style={styles.container} onLayout={event=>{size.current=event.nativeEvent.layout;update(initialZoom);}}>
  <View {...responder.panHandlers} accessible accessibilityLabel={`${label}, ${Math.round(zoom.scale*100)}%`} accessibilityHint="두 손가락 또는 두 번 탭으로 확대해요" accessibilityActions={[{name:'increment',label:'다음 사진'},{name:'decrement',label:'이전 사진'},{name:'activate',label:'확대 또는 원래 크기'}]} onAccessibilityAction={event=>{if(event.nativeEvent.actionName==='activate')toggle();else props.current.onMove(event.nativeEvent.actionName==='increment'?1:-1);}} style={touchStyle}>
   <View pointerEvents="none" style={[styles.image,{transform:[{translateX:zoom.x},{translateY:zoom.y},{scale:zoom.scale}]}]}><Image key={retry} source={{uri}} resizeMode="contain" style={styles.image} accessible={false} onError={()=>setFailed(true)}/></View>
  </View>
  {failed||!uri?<View style={styles.notice}><Text style={styles.text}>미리보기를 불러오지 못했어요</Text><Pressable accessibilityRole="button" onPress={()=>{setFailed(false);setRetry(value=>value+1);}} style={styles.button}><Text style={styles.text}>다시 불러오기</Text></Pressable></View>:<Pressable accessibilityRole="button" accessibilityLabel={zoom.scale>1?'사진 원래 크기로':'사진 두 배 확대'} onPress={toggle} style={[styles.button,styles.control]}><Text style={styles.text}>{zoom.scale>1?'원래 크기':'확대'}</Text></Pressable>}
 </View>;
}
const touchStyle:ViewStyle & {touchAction?:'none'}={flex:1,...(Platform.OS==='web'?{touchAction:'none' as const}:{})};
const styles=StyleSheet.create({container:{flex:1,minHeight:0,margin:12,backgroundColor:'#202421',borderRadius:18,overflow:'hidden'},image:{width:'100%',height:'100%'},button:{minWidth:44,minHeight:44,padding:12,justifyContent:'center',alignItems:'center',backgroundColor:'#202421',borderRadius:12},control:{position:'absolute',right:8,bottom:8},text:{color:'white',fontSize:14},notice:{position:'absolute',top:0,bottom:0,left:0,right:0,justifyContent:'center',alignItems:'center',gap:12,backgroundColor:'#202421'}});
