import type {Photo} from './domain';

export type AlbumSaveState={albumId?:string;assets:Record<string,{assetId:string;inAlbum:boolean}>};
export type AlbumSaveOperations={
 findAlbum:()=>Promise<string|undefined>;
 createAsset:(photo:Photo)=>Promise<string>;
 createAlbum:(assetId:string)=>Promise<string>;
 addToAlbum:(assetId:string,albumId:string)=>Promise<void>;
 persist:(state:AlbumSaveState)=>Promise<void>;
};

// shortcut: a crash between Photos asset creation and its journal write can duplicate a save; verify recovery on iPhone before release.
export async function saveAlbum(photos:Photo[],state:AlbumSaveState,ops:AlbumSaveOperations,onProgress:()=>void=()=>{}){
 const failures:string[]=[];
 if(!state.albumId){state.albumId=await ops.findAlbum();if(state.albumId)await ops.persist(state);}
 await ops.persist(state);
 for(const photo of photos){
  let entry=state.assets[photo.id];
  if(entry?.inAlbum)continue;
  if(!entry){
   let assetId:string;
   try{assetId=await ops.createAsset(photo)}catch{failures.push(photo.filename);continue;}
   entry={assetId,inAlbum:false};state.assets[photo.id]=entry;
   // Do not create another asset when checkpointing fails. Keep this ID in memory for a retry.
   await ops.persist(state);
  }
  try{
   if(!state.albumId){state.albumId=await ops.createAlbum(entry.assetId);await ops.persist(state);}
   else await ops.addToAlbum(entry.assetId,state.albumId);
   entry.inAlbum=true;
  }catch{failures.push(photo.filename);continue;}
  await ops.persist(state);onProgress();
 }
 return failures;
}
