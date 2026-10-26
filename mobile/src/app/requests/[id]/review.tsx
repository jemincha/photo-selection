import {router} from 'expo-router';
import {Pressable,Text,View} from 'react-native';
import {useRequest} from '../../../request-hook';
import {selectionSummary,choiceLabel,Choice} from '../../../domain';
import * as repo from '../../../repository';
import {Page,Button,PhotoImage,styles,TaskState,useTask} from '../../../ui';
export default function Review(){const {id,store,request,locked}=useRequest(),task=useTask();
 if(!request)return <Page title="내 조합 확인"><TaskState busy={store.loading} error={store.error}/></Page>;
 const {remaining,liked:photos,counts}=selectionSummary(request,store.userId);
 const open=(photoId:string)=>router.push({pathname:'/requests/[id]/photo',params:{id,photoId}});
 return <Page title="이 조합으로 보낼까요?" footer={locked?<Button label="확정 결과 보기" primary onPress={()=>router.replace(`/requests/${id}/result`)}/>:<Button label={remaining.length?`미분류 ${remaining.length}장 이어서 고르기`:'셀렉 제출하기'} primary disabled={task.busy||!request.photos.length} onPress={()=>{if(remaining.length)open(remaining[0].id);else void task.run(async()=>{await repo.submit(request,store.userId);await store.refresh();router.replace(`/requests/${id}/submitted`)})}}/>}>
 <Text style={styles.muted}>좋아로 고른 사진을 모았어요. 사진을 누르면 분류를 수정할 수 있어요.</Text>
 <View style={[styles.card,styles.row,{justifyContent:'space-around'}]}>{(['like','unsure','dislike'] as Choice[]).map(value=><View key={value} style={{alignItems:'center',gap:4}}><Text style={styles.title}>{counts[value]}</Text><Text style={styles.badge}>{choiceLabel[value]}</Text></View>)}</View>
 <TaskState {...task}/><Text style={styles.subtitle}>내가 고른 조합 · {photos.length}장</Text>
 {!photos.length&&<Text style={styles.muted}>좋아로 고른 사진이 없어도 셀렉을 제출할 수 있어요.</Text>}
 <View style={styles.grid}>{photos.map(photo=><Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={`사진 ${request.photos.indexOf(photo)+1} 분류 확인`} style={styles.tile} onPress={()=>open(photo.id)}><PhotoImage photo={photo}/></Pressable>)}</View>
 <Button label="전체 사진 다시 살펴보기" disabled={!request.photos.length} onPress={()=>open(request.photos[0].id)}/>
 <Text style={styles.muted}>내 셀렉이 요청자에게 전달돼요. 게시할 최종 사진은 요청자가 확정해요.</Text>
 </Page>;
}
