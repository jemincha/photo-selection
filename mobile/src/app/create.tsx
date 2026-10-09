import {useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {useStore} from '../store';
import * as repo from '../repository';
import {Page,Field,Button,Notice,TaskState,useTask} from '../ui';
export default function Create(){const {albumId}=useLocalSearchParams<{albumId:string}>(),store=useStore(),task=useTask();const [title,setTitle]=useState('');const album=store.albums.find(a=>a.id===albumId);return <Page title="내 사진 셀렉 요청"><Notice>{album?`${album.title} 앨범에 추가해요.`:'앨범 홈에서 앨범을 먼저 선택해주세요.'}</Notice><Field label="요청 제목" value={title} onChange={setTitle}/><TaskState {...task}/><Button label="만들고 사진 올리기" primary disabled={!album||!title.trim()||task.busy||!store.name} onPress={()=>void task.run(async()=>{const id=await repo.createRequest(store.userId,title,store.name,albumId);await store.refresh();router.replace(`/requests/${id}/upload`)})}/></Page>}
