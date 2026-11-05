import {useState} from 'react';
import {router} from 'expo-router';
import {Text,TextInput,View,Pressable} from 'react-native';
import {useStore,cloudEnabled} from './store';
import {Page,Button,styles,TaskState,useTask} from './ui';

export default function Settings(){const store=useStore();return <SettingsContent key={store.userId}/>;}
function SettingsContent(){
 const store=useStore(),task=useTask(),[name,setName]=useState(store.name);
 return <Page title="설정" topInset bottomInset={false}>
  <Text style={styles.text}>닉네임</Text><View style={[styles.input,styles.row,{padding:0}]}><TextInput accessibilityLabel="닉네임" style={{flex:1,padding:14,fontSize:16,color:'#252525'}} value={name} onChangeText={setName} maxLength={20}/><Pressable accessibilityRole="button" accessibilityLabel="닉네임 저장" accessibilityState={{disabled:task.busy||!name.trim()}} disabled={task.busy||!name.trim()} onPress={()=>void task.run(()=>store.setName(name))} style={{minWidth:56,minHeight:44,alignItems:'center',justifyContent:'center',padding:12}}><Text style={styles.buttonText}>저장</Text></Pressable></View>
  <TaskState {...task}/><TaskState busy={false} error={store.error}/>
  <Button label="개인정보 및 이용 약관" onPress={()=>router.push('/legal')}/>
  <Button label="도움과 문의" onPress={()=>router.push('/support')}/>
  <Button label="계정 및 보안" onPress={()=>router.push('/account-security')}/>
  {!cloudEnabled&&<Text style={styles.muted}>로컬 테스트 · 이 기기에만 보관돼요. 다른 기기와의 공유는 서버 연결 후 사용할 수 있어요.</Text>}
  {!cloudEnabled&&<><Text style={styles.badge}>현재 사용자 · {store.name}</Text><Button label="사용자 전환" disabled={task.busy} onPress={()=>void task.run(()=>store.switchUser())}/></>}
 </Page>;
}
