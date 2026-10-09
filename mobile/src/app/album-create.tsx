import {useState} from 'react';
import {router} from 'expo-router';
import {useStore} from '../store';
import * as repo from '../repository';
import {Page,Field,Button,Notice,TaskState,useTask} from '../ui';
export default function CreateAlbum(){const store=useStore(),task=useTask(),[title,setTitle]=useState('');return <Page title="새 앨범"><Field label="앨범 이름" value={title} onChange={setTitle}/><Notice>예: 제주 여행, 우리의 주말. 같은 앨범 안에서 각자 사진을 올리고 서로 셀렉해요.</Notice><TaskState {...task}/><Button label="앨범 만들기" primary disabled={!title.trim()||!store.name||task.busy} onPress={()=>void task.run(async()=>{const id=await repo.createAlbum(store.userId,title,store.name);await store.refresh();router.replace(`/albums/${id}`)})}/></Page>}
