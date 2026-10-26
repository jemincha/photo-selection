import type {ImagePickerAsset} from 'expo-image-picker';
import type {UploadStage} from './upload-error';
export type NativeUploadItem={id:string;asset:ImagePickerAsset;status:'waiting'|'processing'|'done'|'failed';stage?:UploadStage;error?:string};
export function restoreNativeItems(raw:string|null):NativeUploadItem[]{
 const items:unknown=raw?JSON.parse(raw):[];
 if(!Array.isArray(items)||items.some(item=>!item||typeof item.id!=='string'||!item.asset||typeof item.asset.uri!=='string'||!['waiting','processing','done','failed'].includes(item.status)))throw new Error('사진 준비 기록을 읽지 못했어요. 원본을 보호하기 위해 자동으로 새 작업을 만들지 않았어요.');
 return items.map(item=>({...item,status:item.status==='done'?'done':'failed',error:item.status==='done'?undefined:'중단된 사진을 이어서 준비할 수 있어요.'}));
}
export function mergeNativeSelection(items:NativeUploadItem[],assets:ImagePickerAsset[],id:()=>string):NativeUploadItem[]{
 if(!items.some(item=>item.status!=='done'))return assets.map(asset=>({id:id(),asset:{...asset},status:'waiting'}));
 const used=new Set<ImagePickerAsset>();
 const result=items.map(item=>{
  if(item.status==='done')return item;
  const match=assets.find(asset=>!used.has(asset)&&(item.asset.assetId&&asset.assetId?item.asset.assetId===asset.assetId:!!item.asset.fileName&&!!item.asset.fileSize&&item.asset.fileName===asset.fileName&&item.asset.fileSize===asset.fileSize&&item.asset.mimeType===asset.mimeType));
  if(!match)return item;used.add(match);return {...item,asset:{...match},status:'waiting' as const,error:undefined};
 });
 if(!used.size)throw new Error('목록에 남은 사진과 같은 파일을 선택해주세요. 완료한 사진은 다시 추가하지 않아요.');
 return result;
}
