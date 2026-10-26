import {Directory,Paths} from 'expo-file-system';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {pendingPhotos} from './pending-photos';
import {removePhotoFiles} from './photo-storage';
import {removeUploadSessions} from './upload-queue-storage';

export async function clearDeviceData(requestId?:string,photoIds?:string[]){
 if(requestId)pendingPhotos.delete(requestId);else pendingPhotos.clear();
 const keys=await AsyncStorage.getAllKeys();
 const remove=keys.filter(key=>requestId?(key.startsWith('seollek-native-upload:')||key.startsWith('seollek-album-save:'))&&key.endsWith(`:${requestId}`):key!=='seollek-deletion-pending'&&(key.startsWith('seollek-')||key.startsWith('photo-selection-')||key==='selection-swipe-hint'));
 const staged:string[]=[];
 for(const key of remove.filter(k=>k.startsWith('seollek-native-upload:'))){const raw=await AsyncStorage.getItem(key);try{const items=raw?JSON.parse(raw):[];if(Array.isArray(items))for(const item of items)if(typeof item?.id==='string')staged.push(item.id);}catch{/* A broken manifest must not prevent account deletion. */}}
 if(Platform.OS==='web'){await removePhotoFiles(photoIds);await removeUploadSessions(requestId);}
 else{
  const ids=photoIds?new Set([...photoIds,...staged]):null;
  for(const root of [Paths.document,Paths.cache])for(const entry of new Directory(root).list()){
   const match=entry.name.match(/^(?:upload-)?([0-9a-f-]{36})(?:-thumb)?\.[a-zA-Z0-9]+$/);
   if(match&&(!ids||ids.has(match[1])))entry.delete();
  }
 }
 if(remove.length)await AsyncStorage.multiRemove(remove);
}
