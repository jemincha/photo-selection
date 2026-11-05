import {useEffect,useState} from 'react';
import {Linking,Text,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useStore,cloudEnabled} from '../store';
import * as repo from '../repository';
import {feedbackInput} from '../feedback';
import type {FeedbackKind} from '../feedback';
import {Button,Field,Page,styles,useTask,TaskState} from '../ui';
import {releaseInfo} from '../release-info';

export default function Support(){const store=useStore();return <SupportContent key={store.userId}/>;}
function SupportContent(){
 const store=useStore(),task=useTask(),[kind,setKind]=useState<FeedbackKind>('bug'),[body,setBody]=useState(''),[notice,setNotice]=useState(''),[faq,setFaq]=useState(false);
 const key=`seollek-feedback-draft:${store.userId}`;
 useEffect(()=>{let active=true;void AsyncStorage.getItem(key).then(raw=>{if(raw&&active){const data=JSON.parse(raw),input=feedbackInput(data.kind,data.body);setKind(input.kind);setBody(input.body);}}).catch(()=>{});return()=>{active=false;};},[key]);
 const send=()=>void task.run(async()=>{const input=feedbackInput(kind,body);await AsyncStorage.setItem(key,JSON.stringify(input));const result=await repo.submitFeedback(store.userId,input.kind,input.body);if(result.delivered){await AsyncStorage.removeItem(key);setBody('');setNotice('접수했어요. 운영자가 확인할게요.');}else setNotice('이 기기에 임시 저장했어요. 운영자에게 전송되지는 않았어요. 서버 연결 후 보내거나 이메일로 문의해주세요.');});
 return <Page title="도움과 문의"><Text style={styles.subtitle}>버그 리포트 · 제안사항</Text><View style={styles.row}>{(['bug','suggestion'] as const).map(value=><View key={value} style={{flex:1}}><Button label={`${kind===value?'✓ ':''}${value==='bug'?'버그 리포트':'제안사항'}`} onPress={()=>setKind(value)}/></View>)}</View><Field label={kind==='bug'?'어떤 상황에서 문제가 생겼나요?':'어떤 점이 달라지면 좋을까요?'} value={body} onChange={setBody} multiline maxLength={2000}/><Text style={styles.muted}>비밀번호·결제 정보·개인 사진은 적지 마세요. 전송 실패 시 작성 내용은 이 기기에 남겨요.</Text><Button label={cloudEnabled?'보내기':'이 기기에 임시 저장'} primary disabled={task.busy||body.trim().length<5} onPress={send}/><TaskState {...task}/>{!!notice&&<Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
 {releaseInfo.email&&<Button label="이메일로 문의" onPress={()=>void task.run(()=>Linking.openURL(`mailto:${releaseInfo.email}?subject=${encodeURIComponent(kind==='bug'?'설렉 버그 리포트':'설렉 제안사항')}&body=${encodeURIComponent(body)}`))}/>}
 <Button label={faq?'자주 묻는 질문 접기':'자주 묻는 질문'} onPress={()=>setFaq(!faq)}/>{faq&&<><Text style={styles.subtitle}>사진이 준비되지 않나요?</Text><Text style={styles.text}>iCloud 사진은 사진 앱에서 원본 다운로드를 기다린 뒤 다시 시도해주세요. 한 장 최대 25MB, 묶음당 최대 100장이에요. HEIC 미리보기가 되지 않으면 JPEG 사진을 이용해주세요.</Text><Text style={styles.subtitle}>사진 저장과 삭제</Text><Text style={styles.text}>결과의 원본 앨범 저장에서 남은 사진을 다시 저장할 수 있어요. 앱 데이터 삭제는 사진 앱에 따로 저장한 사진을 지우지 않아요. 최종 확정 후 서버 사진과 셀렉은 30일 동안 보관해요.</Text><Text style={styles.subtitle}>신고와 차단</Text><Text style={styles.text}>사진·결과 화면의 ••• 메뉴에서 신고하거나 참여자를 차단할 수 있어요.</Text></>}
 </Page>;
}
