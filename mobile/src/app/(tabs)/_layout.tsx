import {Tabs} from 'expo-router';
import {Text} from 'react-native';
import {useStore} from '../../store';
import {Onboarding} from '../../main-screens';
export default function MainTabs(){
 const store=useStore();
 if(store.loading||!store.name)return <Onboarding/>;
 return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:'#98604b',tabBarInactiveTintColor:'#717670',tabBarStyle:{backgroundColor:'#fcfbf8'}}}>
  <Tabs.Screen name="index" options={{title:'홈',tabBarIcon:({color})=><Text style={{fontSize:23,color}}>⌂</Text>}}/>
  <Tabs.Screen name="friends" options={{title:'친구',tabBarBadge:store.invitations.length||undefined,tabBarIcon:({color})=><Text style={{fontSize:21,color}}>♧</Text>}}/>
  <Tabs.Screen name="albums" options={{title:'보관함',tabBarIcon:({color})=><Text style={{fontSize:21,color}}>▤</Text>}}/>
  <Tabs.Screen name="mypage" options={{title:'설정',tabBarIcon:({color})=><Text style={{fontSize:22,color}}>⚙</Text>}}/>
 </Tabs>;
}
