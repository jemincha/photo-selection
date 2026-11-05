import {router,useLocalSearchParams} from 'expo-router';
import {Text} from 'react-native';
import {useStore} from '../store';
import {Page,Button,styles} from '../ui';
export default function Select(){const {albumId}=useLocalSearchParams<{albumId:string}>(),store=useStore(),batches=store.requests.filter(r=>r.albumId===albumId&&r.ownerId===store.userId&&r.photos.length);return <Page title="내 사진 최종 선택"><Text style={styles.muted}>추가한 사진 묶음마다 친구의 투표를 참고해 최종 선택해요.</Text>{batches.map((r,index)=><Button key={r.id} label={`사진 묶음 ${index+1} · ${r.photos.length}장${r.status==='confirmed'?' · 선택 완료':''}`} onPress={()=>router.push(`/requests/${r.id}/result`)}/>)}{!batches.length&&<Text style={styles.text}>먼저 내 사진을 올려주세요.</Text>}</Page>;}
