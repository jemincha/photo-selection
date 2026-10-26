import {Stack} from 'expo-router';
import {useStore} from '../../store';
import {Onboarding} from '../../main-screens';
export default function MainTabs(){
 const store=useStore();
 if(store.loading||!store.name)return <Onboarding/>;
 return <Stack screenOptions={{headerShown:false}}/>;
}
