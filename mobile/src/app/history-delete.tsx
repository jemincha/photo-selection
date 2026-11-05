import {useState} from 'react';
import {router} from 'expo-router';
import {Text} from 'react-native';
import {useStore} from '../store';
import {Button,Field,Page,styles,TaskState,useTask} from '../ui';
export default function HistoryDelete(){const store=useStore(),task=useTask(),[confirmation,setConfirmation]=useState('');return <Page title="이벤트 데이터 삭제"><Text style={styles.text}>내 업로드와 이벤트 참여·투표 기록을 삭제해요. 친구가 참여 중인 이벤트에서는 내 사진과 기록만 지워요. 다른 사람이 올린 사진과 내 계정·닉네임·친구 연결은 남아요.</Text><Text style={styles.text}>사진 앱에 저장된 사본은 지워지지 않아요. 되돌릴 수 없어요.</Text><Field label="계속하려면 ‘삭제’를 입력해주세요" value={confirmation} onChange={setConfirmation} maxLength={2}/><Button label="이벤트 데이터 삭제" primary disabled={confirmation!=='삭제'||task.busy} onPress={()=>void task.run(async()=>{await store.clearHistory();router.replace('/');})}/><TaskState {...task}/></Page>;}
