import {useLocalSearchParams} from 'expo-router';
import {useStore} from './store';
export function useRequest(){const {id}=useLocalSearchParams<{id:string}>();const store=useStore();const request=store.requests.find(r=>r.id===id);return {id,store,request,owner:request?.ownerId===store.userId,locked:request?.status==='confirmed'};}
