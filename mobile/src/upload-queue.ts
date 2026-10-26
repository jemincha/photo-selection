import type {UploadStage} from './upload-error';
export type UploadItem={id:string;filename:string;mime:string;bytes:number;file?:Blob;stored?:boolean;status:'waiting'|'processing'|'done'|'failed';stage?:UploadStage;error?:string;thumbnail?:string;durations:Partial<Record<UploadStage,number>>};
export type UploadSnapshot={items:UploadItem[];busy:boolean;ready:boolean;restored:boolean;error:string};
export type QueueStorage={load:()=>Promise<UploadItem[]>;manifest:(items:UploadItem[])=>Promise<void>;attach:(item:UploadItem)=>Promise<void>;result:(item:UploadItem)=>Promise<void>};
export type UploadTransport=(item:UploadItem,onStage:(stage:UploadStage)=>void)=>Promise<{thumbnail?:string}|void>;

export class UploadQueue{
 private snapshot:UploadSnapshot={items:[],busy:false,ready:false,restored:false,error:''};
 private listeners=new Set<()=>void>();private loading?:Promise<void>;
 private storage:QueueStorage;
 constructor(storage:QueueStorage){this.storage=storage}
 getSnapshot=()=>this.snapshot;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}};
 private emit(patch:Partial<UploadSnapshot>){this.snapshot={...this.snapshot,...patch};for(const listener of this.listeners)listener();}
 private update(id:string,patch:Partial<UploadItem>){this.emit({items:this.snapshot.items.map(item=>item.id===id?{...item,...patch}:item)});}
 load(){if(!this.loading)this.loading=(async()=>{try{const items=await this.storage.load();this.emit({items:items.map(item=>({...item,thumbnail:undefined,stage:undefined,status:item.status==='done'?'done':item.file?'waiting':'failed',error:item.file?undefined:item.status==='done'?undefined:'임시 보관 전에 중단된 사진이에요. 같은 사진을 다시 선택해주세요.'})),ready:true,restored:items.some(item=>item.status!=='done')})}catch(error){this.emit({ready:true,error:String(error)})}})();return this.loading;}
 async add(selected:UploadItem[],transport:UploadTransport){
  await this.load();if(this.snapshot.busy)return;
  if(!selected.length)return;
  if(selected.length>30)throw new Error('한 번에 최대 30장까지 선택해주세요.');
  // On recovery, selecting the whole group again matches unfinished files to
  // their stable IDs. Completed files are skipped; different files aren't added.
  const unfinished=this.snapshot.items.some(item=>item.status!=='done');
  let items=selected;
  if(unfinished){const used=new Set<string>();items=this.snapshot.items.map(item=>{
   if(item.status==='done'||item.stored)return item;
   const match=selected.find(candidate=>!used.has(candidate.id)&&candidate.filename===item.filename&&candidate.bytes===item.bytes&&candidate.mime===item.mime);
   if(!match)return item;used.add(match.id);return {...item,file:match.file,status:'waiting' as const,error:undefined};
  });if(!items.some(item=>item.file&&!item.stored))throw new Error('목록에 남은 사진과 같은 파일을 선택해주세요. 완료한 사진은 다시 추가하지 않아요.');}
  await this.run(items,transport);
 }
 async resume(transport:UploadTransport){
  await this.load();if(this.snapshot.busy)return;
  await this.run(this.snapshot.items,transport);
 }
 private async run(items:UploadItem[],transport:UploadTransport){
  this.emit({items,busy:true,restored:false,error:''});
  try{
   await this.storage.manifest(items);
   await this.prepareAndProcess(transport);
  }catch(error){
   this.emit({error:error instanceof Error?error.message:String(error)});
  }finally{
   this.emit({busy:false});
  }
 }
 private async prepareAndProcess(transport:UploadTransport){
  // Preserve names first, then File handles before any original is decoded.
  // If the browser dies during this phase, even missing files stay in the list.
  for(const item of this.snapshot.items.filter(item=>item.status!=='done'&&!item.stored&&item.file)){
   const start=Date.now();this.update(item.id,{status:'processing',stage:'queue',error:undefined});
   try{await this.storage.attach(item);this.update(item.id,{stored:true,status:'waiting',stage:undefined,durations:{...item.durations,queue:Date.now()-start}})}catch(error){this.update(item.id,{status:'failed',stage:undefined,error:`임시 보관 실패: ${error instanceof Error?error.message:String(error)}`})}
  }
  // One decoder at a time: 20 originals must never be displayed or decoded in parallel.
  for(const item of this.snapshot.items.filter(item=>item.status!=='done'&&item.stored&&item.file)){
   let stage:UploadStage|undefined,start=Date.now();const durations={...item.durations};
   const onStage=(next:UploadStage)=>{const now=Date.now();if(stage)durations[stage]=(durations[stage]||0)+now-start;stage=next;start=now;this.update(item.id,{status:'processing',stage:next,error:undefined,durations:{...durations}})};
   try{const result=await transport(item,onStage);if(stage)durations[stage]=(durations[stage]||0)+Date.now()-start;
    const complete={...item,status:'done' as const,stage:undefined,file:undefined,thumbnail:result?.thumbnail,error:undefined,durations};
    // If persistence fails after registration, retain the file and the same ID.
    // Retry checks the repository first, so it cannot add the completed photo twice.
    await this.storage.result(complete);this.update(item.id,complete);
   }catch(error){if(stage)durations[stage]=(durations[stage]||0)+Date.now()-start;const failed={...item,status:'failed' as const,stage:undefined,error:error instanceof Error?error.message:String(error),durations};this.update(item.id,failed);try{await this.storage.result(failed)}catch{/* Keep the previously persisted File for recovery. */}}
   await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
 }
}
