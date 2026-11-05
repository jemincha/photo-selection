import {useState} from 'react';
import {router} from 'expo-router';
import {Text,View} from 'react-native';
import {useStore} from './store';
import {eventArchived} from './event-domain';
import * as repo from './repository';
import {Page,Button,styles,TaskState,useTask} from './ui';

export default function Friends(){
 const store=useStore(),task=useTask(),[choosing,setChoosing]=useState(''),[notice,setNotice]=useState('');
 const active=store.albums.filter(a=>a.members.some(m=>m.userId===store.userId)&&!eventArchived(a,store.requests)&&store.requests.some(r=>r.albumId===a.id&&r.photos.length));
 return <Page title="친구" topInset bottomInset={false}><Text style={styles.muted}>초대 링크로 연결된 친구를 기억해요. 다음에는 여기서 바로 초대해요.</Text><TaskState {...task}/><TaskState busy={false} error={store.error}/>{!!notice&&<Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
  {store.invitations.map(invite=><View key={invite.id} style={styles.card}><Text style={styles.subtitle}>{invite.title}</Text><Text style={styles.text}>{invite.inviterName}님이 초대했어요.</Text><View style={styles.row}><View style={{flex:1}}><Button label="참여하기" primary disabled={task.busy} onPress={()=>void task.run(async()=>{await repo.respondEventInvite(invite.id,store.userId,store.name,true);await store.refresh();router.push(`/albums/${invite.albumId}`);})}/></View><View style={{flex:1}}><Button label="거절" disabled={task.busy} onPress={()=>void task.run(async()=>{await repo.respondEventInvite(invite.id,store.userId,store.name,false);await store.refresh();})}/></View></View></View>)}
  {!store.friends.length&&<Text style={styles.text}>아직 연결된 친구가 없어요. 이벤트에서 초대 링크를 공유해보세요.</Text>}
  {store.friends.map(friend=><View key={friend.userId} style={styles.card}><View style={[styles.row,{justifyContent:'space-between'}]}><Text style={styles.subtitle}>{friend.nickname}</Text><Button label={choosing===friend.userId?'접기':'이벤트에 초대'} disabled={task.busy} onPress={()=>setChoosing(choosing===friend.userId?'':friend.userId)}/></View>{choosing===friend.userId&&<>{active.filter(a=>!a.members.some(m=>m.userId===friend.userId)&&a.members.length<3).map(event=><Button key={event.id} label={event.title} disabled={task.busy} onPress={()=>void task.run(async()=>{await repo.inviteFriend(event,store.userId,friend.userId);await store.refresh();setChoosing('');setNotice(`${friend.nickname}님에게 초대를 보냈어요.`);})}/>)}{!active.some(a=>!a.members.some(m=>m.userId===friend.userId)&&a.members.length<3)&&<Text style={styles.muted}>초대할 진행 중 이벤트가 없어요. 홈에서 사진을 올려 새 이벤트를 만들어주세요.</Text>}</>}</View>)}
 </Page>;
}
