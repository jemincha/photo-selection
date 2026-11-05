import {router} from 'expo-router';
import {Text} from 'react-native';
import {Page,Button,styles} from '../ui';
export default function AccountSecurity(){return <Page title="계정 및 보안"><Text style={styles.subtitle}>데이터 삭제</Text><Text style={styles.text}>내 사진과 이벤트 참여·투표 기록을 삭제해요. 계정, 닉네임과 친구 연결은 유지해요.</Text><Button label="이벤트 데이터 삭제" onPress={()=>router.push('/history-delete')}/><Text style={styles.subtitle}>탈퇴</Text><Text style={styles.text}>계정과 내가 올린 사진, 참여·선택 기록, 친구 연결을 모두 삭제해요.</Text><Button label="탈퇴 · 모든 데이터 삭제" onPress={()=>router.push('/account-delete')}/></Page>;}
