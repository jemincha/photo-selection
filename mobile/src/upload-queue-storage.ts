import type {QueueStorage,UploadItem} from './upload-queue';
let database:Promise<IDBDatabase>|undefined;
function open(){if(!database)database=new Promise((resolve,reject)=>{const request=indexedDB.open('photo-selection-upload-queue',1);request.onupgradeneeded=()=>{request.result.createObjectStore('sessions');request.result.createObjectStore('items')};request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)};request.onerror=()=>{database=undefined;reject(request.error)}});return database;}
function complete(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('임시 사진 보관에 실패했어요.'));tx.onerror=()=>reject(tx.error)})}
export async function removeUploadSessions(requestId?:string){
 const db=await open(),tx=db.transaction(['sessions','items'],'readwrite'),done=complete(tx);
 for(const name of ['sessions','items']){const store=tx.objectStore(name);if(!requestId)store.clear();else{const cursor=store.openCursor();cursor.onsuccess=()=>{const entry=cursor.result;if(!entry)return;if(String(entry.key).split('/')[0].endsWith(`:${requestId}`))entry.delete();entry.continue();};}}
 await done;
}
// File blobs live in IndexedDB, never in localStorage or React serialization.
export function queueStorage(scope:string):QueueStorage{
 const key=(id:string)=>`${scope}/${id}`;
 return {
  async load(){const db=await open();return new Promise<UploadItem[]>((resolve,reject)=>{const tx=db.transaction(['sessions','items'],'readonly'),records=new Map<string,UploadItem>();let ids:string[]=[];tx.objectStore('sessions').get(scope).onsuccess=event=>{ids=(event.target as IDBRequest<string[]|undefined>).result||[];for(const id of ids)tx.objectStore('items').get(key(id)).onsuccess=e=>{const item=(e.target as IDBRequest<UploadItem|undefined>).result;if(item)records.set(id,item)}};tx.oncomplete=()=>resolve(ids.flatMap(id=>records.has(id)?[records.get(id)!]:[]));tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error)})},
  async manifest(items){const db=await open(),tx=db.transaction(['sessions','items'],'readwrite'),done=complete(tx);const records=tx.objectStore('items');tx.objectStore('sessions').get(scope).onsuccess=event=>{const previous=(event.target as IDBRequest<string[]|undefined>).result||[];for(const id of previous)if(!items.some(item=>item.id===id))records.delete(key(id));tx.objectStore('sessions').put(items.map(item=>item.id),scope);for(const item of items){const {file:_file,thumbnail:_thumbnail,...metadata}=item;records.get(key(item.id)).onsuccess=e=>{const previous=(e.target as IDBRequest<UploadItem|undefined>).result;records.put({...metadata,file:previous?.file,stored:!!previous?.file||item.status==='done'},key(item.id))}}};await done},
  async attach(item){const db=await open(),tx=db.transaction('items','readwrite'),done=complete(tx);const {thumbnail:_thumbnail,...record}=item;tx.objectStore('items').put({...record,stored:true,status:'waiting',stage:undefined},key(item.id));await done},
  async result(item){const db=await open(),tx=db.transaction('items','readwrite'),done=complete(tx);const {thumbnail:_thumbnail,...record}=item;tx.objectStore('items').put(record,key(item.id));await done},
 };
}
