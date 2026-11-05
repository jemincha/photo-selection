import {router} from 'expo-router';
import {Pressable,Text,View} from 'react-native';
import {useStore} from './store';
import {eventArchived,eventKind} from './event-domain';
import {albumCover} from './domain';
import {Page,PhotoImage,styles,TaskState} from './ui';
export default function Archive(){const store=useStore(),events=store.albums.filter(a=>a.members.some(m=>m.userId===store.userId)&&eventArchived(a,store.requests));return <Page title="보관함" topInset bottomInset={false}><Text style={styles.muted}>완료하거나 마감한 이벤트를 모았어요.</Text><TaskState busy={store.loading} error={store.error}/>{!events.length&&<Text style={styles.text}>아직 마무리한 이벤트가 없어요.</Text>}{events.map(event=>{const batches=store.requests.filter(r=>r.albumId===event.id),cover=albumCover(batches);return <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`${event.title} 다시 보기`} onPress={()=>router.push(`/albums/${event.id}`)} style={styles.card}>{cover&&<PhotoImage photo={cover} wide/>}<View style={{gap:6}}><Text style={styles.badge}>{event.closedAt?'마감':'완료'} · {eventKind(event,batches,store.userId)}</Text><Text style={styles.subtitle}>{event.title}</Text></View></Pressable>})}</Page>;}
