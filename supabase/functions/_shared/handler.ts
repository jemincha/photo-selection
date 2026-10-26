import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {cleanupJob,moderateContent,removeTree,maintenanceAuthorized} from './workflows.ts';

const env=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error(`Missing server setting: ${name}`);return value;};
const cors={'Access-Control-Allow-Origin':Deno.env.get('WEB_ORIGIN')||'http://localhost:8083','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
function checked<T>({data,error}:{data:T;error:unknown}):NonNullable<T>{if(error)throw error;return data as NonNullable<T>;}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function handleRequest(req:Request,maintenanceOnly:boolean){
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>16384)return reply({error:'Request too large'},413);
  const raw=await req.text();if(raw.length>16384)return reply({error:'Request too large'},413);
  const body=JSON.parse(raw),authorization=req.headers.get('Authorization')||'';
  const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  const maintenance=body.action==='maintenance';if(maintenance!==maintenanceOnly)return reply({error:'Wrong endpoint'},403);let userId:string|undefined;
  if(maintenance){
   if(!maintenanceAuthorized(Deno.env.get('SEOLLEK_MAINTENANCE_SECRET'),authorization))return reply({error:'Unauthorized'},401);
   checked(await admin.rpc('enqueue_expired_requests'));
  }else{
   const result=await admin.auth.getUser(authorization.replace(/^Bearer /,''));
   if(result.error||!result.data.user)return reply({error:'Unauthorized'},401);
   userId=result.data.user.id;
  }
  if(body.action==='moderate'){
   if(!uuid(body.requestId)||typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>60||body.consentVersion!=='2026-10-22')return reply({error:'Invalid request'},400);
   const caller=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
   const request=checked(await caller.from('requests').select('id,owner_id,published_at').eq('id',body.requestId).single());
   if(request.owner_id!==userId)return reply({error:'Forbidden'},403);
   const required=checked(await admin.rpc('claim_safety_check',{p_request:request.id,p_title:body.title,p_version:body.consentVersion}));
   if(!required)return reply({approved:true});
   const photos=checked(await caller.from('photos').select('id,thumbnail_path').eq('request_id',request.id).order('id'));
   if(!photos.length||photos.length>30)return reply({error:'Prepare 1 to 30 photos'},400);
   const urls:string[]=[];
   // Only server-selected private previews go to the classifier; never accept client URLs.
   for(const photo of photos)urls.push(checked(await admin.storage.from('request-photos').createSignedUrl(photo.thumbnail_path,120)).signedUrl);
   const approved=await moderateContent(body.title.trim(),urls,env('OPENAI_API_KEY'));
   checked(await admin.rpc('complete_moderation',{p_request:request.id,p_title:body.title.trim(),p_photos:photos.map(p=>p.id),p_approved:approved}));
   return reply({approved});
  }
  if(body.action!=='cleanup'&&!maintenance)return reply({error:'Unknown action'},400);
  const jobs=checked(await admin.rpc('cleanup_jobs',{p_user:userId||null})) as {id:string;kind:'account'|'request'}[];
  let completed=0,failed=0;
  for(const job of jobs){
   try{await cleanupJob(job,{
    requestIds:async()=>checked(await admin.rpc('cleanup_request_ids',{p_id:job.id,p_kind:job.kind})),
    removeFiles:async id=>removeTree(id,{
     list:async prefix=>checked(await admin.storage.from('request-photos').list(prefix,{limit:100,offset:0})).map(f=>({name:f.name,file:!!f.id})),
     remove:async paths=>{checked(await admin.storage.from('request-photos').remove(paths));},
    }),
    finishData:async()=>{checked(await admin.rpc('finish_cleanup_data',{p_id:job.id,p_kind:job.kind}));},
    deleteAuth:async()=>{const result=await admin.auth.admin.deleteUser(job.id);if(result.error&&result.error.status!==404)throw result.error;},
    complete:async()=>{checked(await admin.rpc('complete_cleanup_job',{p_id:job.id,p_kind:job.kind}));},
   });completed++;}catch{failed++;}
  }
  return reply({completed,failed,pending:jobs.length===20||failed>0});
 }catch{
  return reply({error:'처리를 마치지 못했어요. 잠시 후 다시 시도해주세요.'},503);
 }
}
