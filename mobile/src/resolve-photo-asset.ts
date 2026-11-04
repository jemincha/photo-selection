import type {Photo} from './domain';

// A matching Photos ID alone is not enough: edits must match the uploaded bytes.
export async function resolvePhotoAsset(photo:Photo,assetId:string|undefined,ops:{read:(id:string)=>Promise<{id:string;localUri?:string;isNetworkAsset?:boolean}>;verify:(uri:string,photo:Photo)=>Promise<void>;create:()=>Promise<string>}){
 if(assetId&&photo.sha256){
  try{const asset=await ops.read(assetId);if(asset.id===assetId&&asset.localUri&&!asset.isNetworkAsset){await ops.verify(asset.localUri,photo);return assetId;}}catch{/* Missing, edited or inaccessible assets use the verified upload instead. */}
 }
 return ops.create();
}
