import {useRef,useState} from 'react';
import type {ComponentRef} from 'react';
import {Image,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import type {GestureResponderEvent} from 'react-native';

type Props={uri:string;width:number;height:number;label:string;onMove:(delta:number)=>void};
export function NativeZoomPhoto({uri,label,onMove}:Props){
 const scroll=useRef<ComponentRef<typeof ScrollView>|null>(null),scale=useRef(1),touch=useRef({x:0,y:0,multiple:false,zoomed:false,navigated:false});
 const [size,setSize]=useState({width:0,height:0}),[zoom,setZoom]=useState(1),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 const reset=()=>scroll.current?.scrollResponderZoomTo({x:0,y:0,width:size.width,height:size.height,animated:true});
 const start=(event:GestureResponderEvent)=>{const points=event.nativeEvent.touches;if(points.length>1){touch.current.multiple=true;return;}const point=points[0];if(point)touch.current={x:point.pageX,y:point.pageY,multiple:false,zoomed:scale.current>1.01,navigated:false};};
 const swipe=(dx:number,dy:number)=>{const first=touch.current;if(first.navigated||first.multiple||first.zoomed||scale.current>1.01)return;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5){first.navigated=true;onMove(dx>0?1:-1);}};
 const end=(event:GestureResponderEvent)=>{if(event.nativeEvent.touches.length)return;const point=event.nativeEvent.changedTouches[0];if(point)swipe(point.pageX-touch.current.x,point.pageY-touch.current.y);};

 return <View style={styles.container} onLayout={event=>{const {width,height}=event.nativeEvent.layout;setSize({width,height});}}>
  <ScrollView ref={scroll} style={{flex:1}} contentInsetAdjustmentBehavior="never" minimumZoomScale={1} maximumZoomScale={8} pinchGestureEnabled bouncesZoom={false} bounces alwaysBounceHorizontal alwaysBounceVertical={false} centerContent showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={event=>{const value=event.nativeEvent.zoomScale||1;scale.current=value;setZoom(value);}} onTouchStart={start} onTouchMove={event=>{if(event.nativeEvent.touches.length>1)touch.current.multiple=true;}} onTouchEnd={end} onScrollEndDrag={event=>swipe(-event.nativeEvent.contentOffset.x,-event.nativeEvent.contentOffset.y)} accessible accessibilityLabel={`${label}, ${Math.round(zoom*100)}%`} accessibilityHint="두 손가락으로 확대해요. 원래 크기에서 좌우로 사진을 넘겨요." accessibilityActions={[{name:'increment',label:'다음 사진'},{name:'decrement',label:'이전 사진'},{name:'activate',label:'원래 크기'}]} onAccessibilityAction={event=>{if(event.nativeEvent.actionName==='activate')reset();else onMove(event.nativeEvent.actionName==='increment'?1:-1);}}>
   <View style={size}><Image key={retry} source={{uri}} resizeMode="contain" style={{width:'100%',height:'100%'}} accessible={false} onError={()=>setFailed(true)}/></View>
  </ScrollView>
  {failed||!uri?<View style={styles.notice}><Text style={styles.text}>미리보기를 불러오지 못했어요</Text><Pressable accessibilityRole="button" style={styles.button} onPress={()=>{setFailed(false);setRetry(value=>value+1);}}><Text style={styles.text}>다시 불러오기</Text></Pressable></View>:zoom>1.01&&<Pressable accessibilityRole="button" accessibilityLabel="사진 원래 크기로" style={[styles.button,{position:'absolute',right:8,bottom:8}]} onPress={reset}><Text style={styles.text}>원래 크기</Text></Pressable>}
 </View>;
}
const styles=StyleSheet.create({container:{flex:1,minHeight:0,margin:12,backgroundColor:'#202421',borderRadius:18,overflow:'hidden'},button:{minWidth:44,minHeight:44,padding:12,justifyContent:'center',alignItems:'center',backgroundColor:'#202421',borderRadius:12},text:{color:'white',fontSize:14},notice:{position:'absolute',top:0,bottom:0,left:0,right:0,justifyContent:'center',alignItems:'center',gap:12,backgroundColor:'#202421'}});
