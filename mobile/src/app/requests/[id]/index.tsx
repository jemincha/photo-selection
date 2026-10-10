import {router} from 'expo-router';
import {Text,View,Pressable,Share} from 'react-native';
import {useState} from 'react';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import {useRequest} from '../../../request-hook';
import {cloudEnabled} from '../../../store';
import {choiceFor,choiceLabel,nickname} from '../../../domain';
import {Page,Button,Notice,PhotoImage,Comments,styles,useTask,TaskState} from '../../../ui';
export default function Event(){const {id,store,request,owner,locked}=useRequest(),task=useTask();const [filter,setFilter]=useState('all'),[showComments,setShowComments]=useState(false),[tools,setTools]=useState(false),[testing,setTesting]=useState(false),[copied,setCopied]=useState(false);
 if(!request)return <Page title="요청 불러오기"><TaskState busy={store.loading} error={store.error}/><Button label="다시 불러오기" onPress={()=>void store.refresh()}/></Page>;
 const web=process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/,'');const invite=web?`${web}/invite/${request.inviteToken}`:Linking.createURL(`/invite/${request.inviteToken}`);
 const photos=request.photos.filter(p=>filter==='all'||choiceFor(request,store.userId,p.id)===filter);
 const submission=request.submissions?.find(s=>s.userId===store.userId),remaining=request.photos.filter(p=>!choiceFor(request,store.userId,p.id));
 const detail=(photoId:string)=>router.push({pathname:'/requests/[id]/photo',params:{id,photoId}});
 const primaryLabel=locked?'확정 결과 보기':!request.photos.length?(owner?'사진 추가하기':'사진을 기다리고 있어요'):submission?'제출한 조합 보기':remaining.length?'사진 골라주기':'내 조합 확인하기';
 const primaryAction=()=>{if(locked)router.push(`/requests/${id}/result`);else if(!request.photos.length)router.push(`/requests/${id}/upload`);else if(submission)router.push(`/requests/${id}/submitted`);else if(remaining.length)detail(remaining[0].id);else router.push(`/requests/${id}/review`)};
 return <Page title={request.title} footer={<Button label={primaryLabel} primary disabled={task.busy||(!owner&&!request.photos.length)} onPress={primaryAction}/>}>
 <View style={[styles.row,{justifyContent:'space-between'}]}><Text style={styles.badge}>{owner?'내 요청':`${nickname(request,request.ownerId)}님의 요청`} · {locked?'최종 확정':submission?'내 셀렉 제출됨':'셀렉 중'}</Text><Pressable accessibilityRole="button" onPress={()=>setTools(!tools)} style={{padding:10}}><Text style={styles.buttonText}>관리 · 초대 ▾</Text></Pressable></View>
 {tools&&<View style={styles.card}><Text style={styles.muted}>{request.members.map(m=>m.nickname).join(' · ')}</Text>{owner&&!locked&&<><Button label="사진 추가" disabled={task.busy} onPress={()=>router.push(`/requests/${id}/upload`)}/><Button label={copied?'링크를 복사했어요':'앨범 초대 링크 복사'} disabled={task.busy} onPress={()=>void task.run(async()=>{await Clipboard.setStringAsync(invite);setCopied(true)})}/><Button label="앨범 초대 공유" disabled={task.busy} onPress={()=>void task.run(async()=>{await Share.share({message:`${request.title} 앨범에 함께 참여해줘! ${invite}`,url:invite})})}/>{(!cloudEnabled||!web)&&<Text style={styles.muted}>{!cloudEnabled?'로컬 초대는 이 기기에서만 동작해요. 실제 친구 참여는 서버 연결 후 제공해요.':'설치 없이 참여하려면 웹 배포 주소를 연결해주세요.'}</Text>}</>}<Button label="다시 불러오기" onPress={()=>void store.refresh()}/>{!cloudEnabled&&<><Button label={testing?'테스트 도구 접기':'테스트 도구'} onPress={()=>setTesting(!testing)}/>{testing&&<Button label={store.userId==='local-friend'?'내 사용자로 돌아오기':'테스트 친구로 열기'} onPress={()=>void task.run(async()=>{if(store.userId==='local-friend')store.backToMe();else await store.testAsFriend(request)})}/>}</>}</View>}
 <TaskState {...task}/><TaskState busy={false} error={store.error}/>
 <Text style={styles.muted}>{request.photos.length}장 · {locked?'셀렉이 마무리됐어요':`${request.photos.length-remaining.length}장 분류 완료`}</Text>
 <View style={[styles.row,{gap:16}]}>{[['all','전체'],['like','좋아'],['unsure','글쎄'],['dislike','별로']].map(([value,label])=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:filter===value}} onPress={()=>setFilter(value)} style={{paddingVertical:10,borderBottomWidth:filter===value?2:0,borderColor:'#344f42'}}><Text style={filter===value?styles.buttonText:styles.muted}>{label}</Text></Pressable>)}</View>
 {!request.photos.length&&<Notice>{owner?'사진을 추가해 셀렉을 시작하세요.':'요청자가 사진을 올리면 여기서 볼 수 있어요.'}</Notice>}
 {request.photos.length>0&&!photos.length&&<Text style={styles.muted}>이 분류에 해당하는 사진이 없어요.</Text>}
 <View style={styles.grid}>{photos.map(photo=>{const choice=choiceFor(request,store.userId,photo.id);return <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={`사진 ${request.photos.indexOf(photo)+1}, ${choice?choiceLabel[choice]:'미분류'}`} onPress={()=>detail(photo.id)} style={styles.tile}><PhotoImage photo={photo}/><Text style={styles.badge}>{choice?choiceLabel[choice]:'미분류'}</Text></Pressable>})}</View>
 {owner&&request.photos.length>0&&!locked&&<View style={styles.card}><Text style={styles.subtitle}>게시할 최종 사진</Text><Text style={styles.muted}>참여자의 셀렉을 참고해 내가 확정해요. 확정하면 분류와 의견 수정을 마쳐요.</Text><Button label="모두의 조합 비교 · 최종 확정" onPress={()=>router.push(`/requests/${id}/select`)}/></View>}
 {!!request.submissions?.length&&<><Text style={styles.subtitle}>참여자가 고른 조합</Text>{request.submissions.map(sub=><View key={sub.userId} style={styles.card}><Text style={styles.badge}>{nickname(request,sub.userId)} · 좋아 {sub.selectedIds.length}장</Text><View style={styles.grid}>{request.photos.filter(p=>sub.selectedIds.includes(p.id)).map(p=><View key={p.id} style={styles.tile}><PhotoImage photo={p}/></View>)}</View>{!sub.selectedIds.length&&<Text style={styles.muted}>좋아로 고른 사진이 없어요.</Text>}</View>)}</>}
 <Button label={showComments?'전체 의견 접기':'전체 의견 (선택)'} onPress={()=>setShowComments(!showComments)}/>{showComments&&<Comments request={request}/>}
 <Button label="앨범으로 돌아가기" onPress={()=>router.replace(`/albums/${request.albumId}`)}/>
 </Page>;
}
