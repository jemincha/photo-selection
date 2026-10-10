import {Tabs} from 'expo-router';
import {Text} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useStore} from '../../store';
import {Onboarding} from '../../main-screens';
export default function MainTabs(){
 const store=useStore(),insets=useSafeAreaInsets();
 if(store.loading||!store.name)return <Onboarding/>;
 return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:'#252525',tabBarInactiveTintColor:'#94918c',tabBarStyle:{height:68+insets.bottom,backgroundColor:'#fcfbf8',borderTopColor:'#e4e1db'},tabBarLabelStyle:{fontSize:11,fontWeight:'600'},tabBarItemStyle:{paddingVertical:4}}}>
  {([{name:'index',title:'홈',icon:'⌂'},{name:'albums',title:'앨범',icon:'▧'},{name:'friends',title:'친구',icon:'♧'},{name:'mypage',title:'마이페이지',icon:'○'}]).map(tab=><Tabs.Screen key={tab.name} name={tab.name} options={{title:tab.title,tabBarIcon:({color})=><Text accessible={false} style={{color,fontSize:25}}>{tab.icon}</Text>}}/>)}
 </Tabs>;
}
