import {useState} from 'react';
import {router} from 'expo-router';
import {Platform,Share,Text,View} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {useStore,cloudEnabled} from './store';
import type {Request} from './domain';
import * as repo from './repository';
import {Button,Field,styles,TaskState,useTask} from './ui';

export function RequestShare({request}:{request:Request}){
 const store=useStore(),task=useTask(),[message,setMessage]=useState(request.title==='어떤 사진이 제일 좋아?'?'':request.title),[notice,setNotice]=useState(''),[prepared,setPrepared]=useState(''),[preparedToken,setPreparedToken]=useState(''),[consent,setConsent]=useState(false);
 const web=process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/,'');
 const prepare=async()=>{await repo.publish(request,store.userId,message);await store.refresh();return `${web}/invite/${request.inviteToken}`;};
 const readyUrl=(preparedToken===request.inviteToken?prepared:'')||(request.publishedAt&&web?`${web}/invite/${request.inviteToken}`:'');
 const send=()=>void task.run(async()=>{
  if(!web)throw new Error('웹 참여 주소를 연결해야 친구에게 보낼 수 있어요.');
  // Safari requires a fresh tap for sharing/copying after an asynchronous publication.
  if(Platform.OS==='web'&&!readyUrl){setPrepared(await prepare());setPreparedToken(request.inviteToken);setNotice('링크가 준비됐어요. 공유 또는 복사를 눌러 친구에게 보내주세요.');return;}
  const url=readyUrl||await prepare();
  if(Platform.OS==='web'){if(navigator.share)await navigator.share({title:request.title,url});else{await Clipboard.setStringAsync(url);setNotice('링크를 복사했어요. 친구에게 붙여 넣어 보내주세요.');}}
  else await Share.share({message:`${message.trim()||request.title} ${url}`,...(Platform.OS==='ios'?{url}:{})});
 });
 return <View style={{gap:14}}>{!request.publishedAt&&<Field label="친구에게 한마디 · 선택" value={message} onChange={setMessage} maxLength={60}/>}
 <Text style={styles.muted}>보낸 뒤에는 사진을 바꿀 수 없어요. 이 링크에는 이 셀렉의 사진만 담겨요.</Text>
 {cloudEnabled?(request.inviteEnabled===false?<Text style={styles.text}>새 참여를 중지했어요. ••• 메뉴에서 새 링크로 다시 열 수 있어요.</Text>:<>
  {!request.publishedAt&&<><Button label={consent?'✓ 공유 권한·안전 검사에 동의했어요':'공유 권한·안전 검사에 동의'} onPress={()=>setConsent(!consent)}/><Text style={styles.muted}>공유할 권한과 사진 속 인물의 동의를 확인했어요. 문구·미리보기를 OpenAI로 보내 부적절 콘텐츠를 검사하는 데 동의해요.</Text><Button label="개인정보 처리 내용 보기" onPress={()=>router.push('/privacy')}/></>}
  <Button label={task.busy?'안전하게 공유할 준비 중…':readyUrl?'링크 공유하기':'친구에게 보내기'} primary disabled={task.busy||(!request.publishedAt&&!consent)} onPress={send}/>
  {readyUrl&&<Button label="초대 링크 복사" disabled={task.busy} onPress={()=>void task.run(async()=>{await Clipboard.setStringAsync(readyUrl);setNotice('링크를 복사했어요.');})}/>}
 </>):<><Text style={styles.muted}>로컬 테스트 모드예요. 실제 친구 공유는 서버 연결 후 제공해요.</Text><Button label="테스트 친구로 골라보기" primary disabled={task.busy} onPress={()=>void task.run(async()=>{await prepare();await store.testAsFriend(request);const latest=await repo.loadRequest(request.id);router.replace({pathname:'/requests/[id]/photo',params:{id:request.id,photoId:latest.photos[0].id}});})}/></>}
 {!!notice&&<Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}<TaskState {...task}/>
 {request.publishedAt&&<Button label="결과 확인하기" onPress={()=>router.replace(`/requests/${request.id}/result`)}/>}
 </View>;
}
