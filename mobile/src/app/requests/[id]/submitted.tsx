import {router} from 'expo-router';
import {Text,View} from 'react-native';
import {useRequest} from '../../../request-hook';
import {Page,Button,PhotoImage,styles,TaskState} from '../../../ui';
export default function Submitted(){const {id,store,request}=useRequest();if(!request)return <Page title="셀렉 결과"><TaskState busy={store.loading} error={store.error}/></Page>;const submission=request.submissions?.find(s=>s.userId===store.userId);const photos=request.photos.filter(p=>submission?.selectedIds.includes(p.id));return <Page title={submission?'셀렉 제출 완료':'다시 확인해주세요'} footer={<Button label="앨범으로 돌아가기" primary onPress={()=>router.replace(`/albums/${request.albumId}`)}/>}>
 <Text style={styles.muted}>{submission?'내가 고른 조합을 전달했어요. 최종 사진은 요청자가 확정해요.':'분류가 바뀌었거나 새 사진이 추가됐어요. 조합을 확인하고 다시 제출해주세요.'}</Text>
 {submission&&<><Text style={styles.subtitle}>내가 고른 조합 · {photos.length}장</Text>{!photos.length&&<Text style={styles.muted}>좋아로 고른 사진이 없어요. 별로·글쎄 분류도 함께 전달됐어요.</Text>}<View style={styles.grid}>{photos.map(p=><View key={p.id} style={{width:'48%',gap:6}}><PhotoImage photo={p}/></View>)}</View></>}
 {request.status==='selecting'&&<Button label={submission?'내 셀렉 다시 살펴보기':'조합 확인하고 제출하기'} onPress={()=>router.replace(`/requests/${id}/review`)}/>}
 </Page>}
