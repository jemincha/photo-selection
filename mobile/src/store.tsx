import React,{createContext,useContext,useState,useEffect,useCallback,useRef} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import {identity,supabase,cloudEnabled} from './backend';
import * as repository from './repository';
import {Album,Request} from './domain';
type Store={albums:Album[];requests:Request[];userId:string;name:string;setName:(s:string)=>Promise<void>;loading:boolean;error:string;refresh:()=>Promise<void>;testAsFriend:(r:Request)=>Promise<void>;backToMe:()=>void;};
const Context=createContext<Store|null>(null);
export function StoreProvider({children}:{children:React.ReactNode}){
 const [albums,setAlbums]=useState<Album[]>([]);
 const [requests,setRequests]=useState<Request[]>([]),[userId,setUserId]=useState(''),[name,setNickname]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const ownNickname=useRef('');
 const fetching=useRef<Promise<void>|null>(null);
 const refresh=useCallback(async()=>{if(fetching.current)await fetching.current;const pending=(async()=>{try{const [requests,albums]=await Promise.all([repository.listRequests(),repository.listAlbums()]);setRequests(requests);setAlbums(albums);setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}})();fetching.current=pending;try{await pending}finally{if(fetching.current===pending)fetching.current=null}},[]);
 useEffect(()=>{let mounted=true;async function boot(){try{const id=await identity();await repository.initialize();const nickname=await AsyncStorage.getItem('photo-selection-nickname');if(!mounted)return;setUserId(id);setNickname(nickname||'');ownNickname.current=nickname||'';await refresh();}catch(e){if(mounted)setError(e instanceof Error?e.message:String(e));}finally{if(mounted)setLoading(false)}}void boot();const interval=setInterval(()=>{if(AppState.currentState==='active')void refresh()},5000);const appState=AppState.addEventListener('change',state=>{if(state==='active'){supabase?.auth.startAutoRefresh();void refresh()}else supabase?.auth.stopAutoRefresh()});const {data:subscription}=supabase?.auth.onAuthStateChange((_event,session)=>{if(session&&mounted)setUserId(session.user.id)})||{data:null};return()=>{mounted=false;clearInterval(interval);appState.remove();subscription?.subscription.unsubscribe()}},[refresh]);
 const setName=async(s:string)=>{const text=s.trim();if(!text||text.length>20)throw new Error('이름을 1~20자로 입력해주세요.');await AsyncStorage.setItem(userId==='local-friend'?'photo-selection-friend-nickname':'photo-selection-nickname',text);if(userId!=='local-friend')ownNickname.current=text;setNickname(text)};
 return <Context.Provider value={{albums,requests,userId,name,setName,loading,error,refresh,testAsFriend:async(r)=>{await repository.localFriend(r);setUserId('local-friend');setNickname(await AsyncStorage.getItem('photo-selection-friend-nickname')||'테스트 친구');await refresh()},backToMe:()=>{setUserId('local-me');setNickname(ownNickname.current)}}}>{children}</Context.Provider>;
}
export function useStore(){const store=useContext(Context);if(!store)throw new Error('Missing provider');return store;}
export {cloudEnabled};
