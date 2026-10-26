export function maintenanceAuthorized(secret:string|undefined,authorization:string){return !!secret&&secret.length>=32&&authorization===`Bearer ${secret}`;}
export async function moderateContent(title:string,urls:string[],apiKey:string,send:typeof fetch=fetch):Promise<boolean>{
 if(!apiKey||!urls.length||urls.length>30)throw new Error('Safety service is not configured');
 for(let offset=0;offset<urls.length;offset+=5){
  const response=await send('https://api.openai.com/v1/moderations',{
   method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),
   body:JSON.stringify({model:'omni-moderation-latest',input:[{type:'text',text:title},...urls.slice(offset,offset+5).map(url=>({type:'image_url',image_url:{url}}))]}),
  });
  if(!response.ok)throw new Error('Safety service unavailable');
  const result=await response.json();
  if(!Array.isArray(result.results)||result.results.length!==1||typeof result.results[0]?.flagged!=='boolean')throw new Error('Invalid safety response');
  if(result.results[0].flagged)return false;
 }
 return true;
}
type Job={id:string;kind:'account'|'request'};
type Cleanup={requestIds:()=>Promise<string[]>;removeFiles:(id:string)=>Promise<void>;finishData:()=>Promise<void>;deleteAuth:()=>Promise<void>;complete:()=>Promise<void>};
export async function cleanupJob(job:Job,ops:Cleanup){
 for(const id of await ops.requestIds())await ops.removeFiles(id);
 await ops.finishData();
 if(job.kind==='account')await ops.deleteAuth();
 await ops.complete();
}
export async function removeTree(prefix:string,storage:{list:(prefix:string)=>Promise<{name:string;file:boolean}[]>;remove:(paths:string[])=>Promise<void>}):Promise<void>{
 for(let page=0;page<100;page++){
  const entries=await storage.list(prefix);if(!entries.length)return;
  for(const folder of entries.filter(e=>!e.file))await removeTree(`${prefix}/${folder.name}`,storage);
  const files=entries.filter(e=>e.file).map(e=>`${prefix}/${e.name}`);if(files.length)await storage.remove(files);
 }
 throw new Error('Storage cleanup needs another pass');
}
