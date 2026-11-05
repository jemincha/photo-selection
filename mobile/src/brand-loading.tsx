import {useEffect,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,Platform,StyleSheet,Text,View} from 'react-native';

function letterMotion(progress:Animated.AnimatedInterpolation<number>,tilt:number){
 const inputRange=[0,.42,.64,.79,.9,1];
 return {transform:[
  {translateY:progress.interpolate({inputRange,outputRange:[-58,5,-19,2,-5,0]})},
  {rotate:progress.interpolate({inputRange,outputRange:[`${tilt}deg`,`${-tilt/2}deg`,`${tilt/3}deg`,'-2deg','1deg','0deg']})},
  {scaleX:progress.interpolate({inputRange,outputRange:[1,1.08,.98,1.03,1,1]})},
  {scaleY:progress.interpolate({inputRange,outputRange:[1,.87,1.03,.96,1,1]})},
 ]};
}

export function BrandLoading({ready,onComplete}:{ready:boolean;onComplete:()=>void}){
 const [progress]=useState(()=>new Animated.Value(0)),[done,setDone]=useState(false);
 const first=progress.interpolate({inputRange:[0,.38,.8,1],outputRange:[0,0,1,1],extrapolate:'clamp'}),second=progress.interpolate({inputRange:[0,.42,.84,1],outputRange:[0,0,1,1],extrapolate:'clamp'});
 useEffect(()=>{
  let active=true,settled=false,motion:Animated.CompositeAnimation|undefined;
  const settle=()=>{settled=true;motion?.stop();progress.setValue(1);if(active)setDone(true);};
  const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',enabled=>{if(enabled)settle();});
  void (async()=>{
   let reduced=true;try{reduced=await AccessibilityInfo.isReduceMotionEnabled();}catch{/* Keep the static mark when motion preferences are unavailable. */}
   if(!active)return;
   if(reduced||settled){settle();return;}
   motion=Animated.timing(progress,{toValue:1,duration:3400,easing:Easing.linear,useNativeDriver:Platform.OS!=='web'});
   motion.start(({finished})=>{if(active&&finished)setDone(true);});
  })();
  return()=>{active=false;subscription.remove();motion?.stop();};
 },[progress]);
 useEffect(()=>{if(ready&&done)onComplete();},[ready,done,onComplete]);
 return <View style={brand.page} accessible accessibilityRole="progressbar" accessibilityLabel="설렉. 시작 중" accessibilityState={{busy:true}}>
  <View style={brand.stage} pointerEvents="none">
   <Animated.Text accessible={false} style={[brand.phrase,{opacity:progress.interpolate({inputRange:[0,.38,.54,1],outputRange:[1,1,0,0]})}]}><Animated.Text style={{opacity:progress.interpolate({inputRange:[0,.28,.38,1],outputRange:[1,1,0,0]})}}>함께한 </Animated.Text>설<Animated.Text style={{opacity:progress.interpolate({inputRange:[0,.28,.38,1],outputRange:[1,1,0,0]})}}>렘을 셀</Animated.Text>렉</Animated.Text>
   <Animated.View style={[brand.shadow,{opacity:second.interpolate({inputRange:[0,.42,1],outputRange:[0,.15,.08]})}]}/>
   <Animated.View style={[brand.letters,{opacity:progress.interpolate({inputRange:[0,.36,.44,1],outputRange:[0,0,1,1]})}]}>
    <Animated.View style={letterMotion(first,-12)}><Text accessible={false} style={brand.letter}>설</Text></Animated.View>
    <Animated.View style={letterMotion(second,10)}><Text accessible={false} style={brand.letter}>렉</Text></Animated.View>
    <Animated.Text accessible={false} style={[brand.dot,{opacity:second.interpolate({inputRange:[0,.64,1],outputRange:[0,0,1]})}]}>.</Animated.Text>
   </Animated.View>
  </View>
 </View>;
}
const brand=StyleSheet.create({page:{flex:1,backgroundColor:'#fcfbf8',alignItems:'center',justifyContent:'center'},stage:{height:180,width:'90%',maxWidth:360,alignItems:'center',justifyContent:'flex-end',paddingBottom:20},phrase:{position:'absolute',top:70,left:0,right:0,textAlign:'center',fontSize:26,fontWeight:'600',lineHeight:40,color:'#252525'},letters:{flexDirection:'row',alignItems:'flex-end'},letter:{fontSize:76,lineHeight:100,fontWeight:'900',letterSpacing:-5,color:'#252525'},dot:{fontSize:76,lineHeight:100,fontWeight:'900',color:'#98604b',marginLeft:2},shadow:{position:'absolute',bottom:28,width:145,height:7,borderRadius:100,backgroundColor:'#252525'}});
