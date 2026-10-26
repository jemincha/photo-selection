import {useState} from 'react';
import {router} from 'expo-router';
import {Text} from 'react-native';
import {useStore,cloudEnabled} from '../store';
import {Button,Field,Page,styles,TaskState,useTask} from '../ui';
export default function DeleteAccount(){
 const store=useStore(),task=useTask(),[confirmation,setConfirmation]=useState('');
 return <Page title={cloudEnabled?'계정과 데이터 삭제':'로컬 테스트 데이터 삭제'}><Text style={styles.text}>내가 올린 원본과 미리보기, 셀렉, 닉네임과 참여·선택 기록을 삭제해요. 친구에게도 내가 만든 셀렉이 보이지 않아요. 되돌릴 수 없어요.</Text><Text style={styles.text}>사진 앱에 저장한 사진과 친구가 따로 저장한 사본은 지워지지 않아요. 서버 작업이 실패하면 접근을 막은 상태로 다시 처리해요.</Text><Text style={styles.muted}>닉네임은 복구 수단이 아니에요. 같은 닉네임으로 다시 시작해도 이전 기록은 돌아오지 않아요.</Text><Field label="계속하려면 ‘삭제’를 입력해주세요" value={confirmation} onChange={setConfirmation} maxLength={2}/><Button label="계정과 데이터 삭제 요청" primary disabled={confirmation!=='삭제'||task.busy} onPress={()=>void task.run(store.deleteAccount)}/><TaskState {...task}/><Button label="취소" disabled={task.busy} onPress={()=>router.back()}/></Page>;
}
