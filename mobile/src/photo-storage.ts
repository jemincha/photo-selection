const prefix='photo-file:';
let database:Promise<IDBDatabase>|undefined;
const urls=new Map<string,string>();
function open(){
 if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(new Error('이 브라우저에서 사진 저장소를 사용할 수 없어요. 일반 Safari 탭에서 다시 시도해주세요.'));return;}
  const request=indexedDB.open('photo-selection-files',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('files');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('사진 저장소를 열지 못했어요.'));
  request.onblocked=()=>reject(new Error('다른 탭을 닫은 뒤 다시 시도해주세요.'));
 });
 return database;
}
export async function storePhotoFiles(id:string,original:Blob,thumbnail:Blob){
 const db=await open();
 await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('files','readwrite');
  tx.objectStore('files').put(original,`${id}:original`);
  tx.objectStore('files').put(thumbnail,`${id}:thumbnail`);
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('사진 파일 저장에 실패했어요.'));tx.onerror=()=>reject(tx.error);
 });
 return {original:`${prefix}${id}:original`,thumbnail:`${prefix}${id}:thumbnail`};
}
export async function photoFileUrl(reference:string){
 if(!reference.startsWith(prefix))return reference; // Legacy data URLs remain readable.
 const key=reference.slice(prefix.length),cached=urls.get(key);if(cached)return cached;
 const db=await open();const blob=await new Promise<Blob>((resolve,reject)=>{
  const request=db.transaction('files','readonly').objectStore('files').get(key);
  request.onsuccess=()=>request.result?resolve(request.result):reject(new Error('저장된 사진 파일을 찾을 수 없어요.'));
  request.onerror=()=>reject(request.error);
 });
 const url=URL.createObjectURL(blob);urls.set(key,url);return url;
}
