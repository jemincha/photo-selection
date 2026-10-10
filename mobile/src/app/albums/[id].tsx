import {router,useLocalSearchParams} from 'expo-router';
import {Pressable,Text,View} from 'react-native';
import {useStore} from '../../store';
import {Page,Button,Notice,PhotoImage,styles,TaskState} from '../../ui';
export default function Album(){const {id}=useLocalSearchParams<{id:string}>(),store=useStore();const album=store.albums.find(a=>a.id===id&&a.members.some(m=>m.userId===store.userId));if(!album)return <Page title="앨범"><TaskState busy={store.loading} error={store.error}/><Notice>앨범을 불러올 수 없어요.</Notice><Button label="앨범 홈" onPress={()=>router.replace('/')}/></Page>;
 const requests=store.requests.filter(r=>r.albumId===id);
 return <Page title={album.title} footer={<Button label="+ 내 사진 요청 추가" primary disabled={!store.name} onPress={()=>router.push({pathname:'/create',params:{albumId:id}})}/>}>
 <Text style={styles.muted}>{album.members.map(m=>m.nickname).join(' · ')} · 요청 {requests.length}개</Text>
 <TaskState busy={false} error={store.error}/>
 {!requests.length&&<View style={styles.card}><Text style={styles.subtitle}>함께 고를 사진을 올려주세요</Text><Text style={styles.muted}>각자 사진 요청을 추가하고 서로 골라줄 수 있어요. 최종 사진은 올린 사람이 확정해요.</Text></View>}
 {requests.map(r=>{const submission=r.submissions?.find(s=>s.userId===store.userId),cover=r.photos.find(p=>r.selectedIds.includes(p.id))||r.photos[0],mine=r.ownerId===store.userId;return <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${r.title}, ${mine?'내 요청':'친구 요청'} 열기`} onPress={()=>router.push(`/requests/${r.id}`)} style={[styles.card,{padding:12}]}>{cover&&<PhotoImage photo={cover} wide/>}<View style={[styles.row,{justifyContent:'space-between'}]}><Text style={styles.badge}>{mine?'내 사진':`${r.members.find(m=>m.userId===r.ownerId)?.nickname}님의 사진`}</Text><Text style={styles.badge}>{r.status==='confirmed'?'최종 확정':submission?'내 셀렉 제출됨':r.photos.length?'셀렉 중':'사진 준비 중'}</Text></View><Text style={styles.subtitle}>{r.title}</Text><Text style={styles.muted}>{r.photos.length}장 · {r.status==='confirmed'?'최종 조합 보기 →':submission?'제출한 조합 보기 →':mine?'내 사진 살펴보기 →':'친구 사진 골라주기 →'}</Text></Pressable>})}
 </Page>}
