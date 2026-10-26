import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// PostgreSQL engine with only the platform-owned auth/storage boundary stubbed.
const db=new PGlite();
await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 alter table storage.objects enable row level security;
 grant usage on schema public,auth,storage to authenticated,service_role;
 grant select,insert,delete on storage.objects to authenticated;
 grant all on all tables in schema auth,storage to service_role;
`);
for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
const owner='10000000-0000-4000-8000-000000000001',friend='10000000-0000-4000-8000-000000000002',outsider='10000000-0000-4000-8000-000000000003';
await db.query('insert into auth.users values($1),($2),($3)',[owner,friend,outsider]);
async function as(uid,sql,args=[]){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');try{return await db.query(sql,args)}finally{await db.exec('reset role')}}
async function scalar(uid,sql,args=[]){return Object.values((await as(uid,sql,args)).rows[0])[0]}
async function fixture(){
 const id=await scalar(owner,"select public.create_simple_request('나')"),photo=crypto.randomUUID(),filename=`${photo}.jpg`;
 await as(owner,'insert into storage.objects(bucket_id,name) values($1,$2),($1,$3)',['request-photos',`${id}/original/${photo}/${filename}`,`${id}/thumbnail/${photo}.jpg`]);
 await as(owner,'select public.register_photo($1,$2,$3,$4,100,100,10,$5)',[photo,id,filename,'image/jpeg','a'.repeat(64)]);
 return {id,photo,token:await scalar(owner,'select invite_token from requests where id=$1',[id])};
}
async function approve(f){await db.query('select public.complete_moderation($1,$2,$3,true)',[f.id,'어떤 사진이 제일 좋아?',[f.photo]]);await as(owner,'select public.publish_request($1,$2)',[f.id,'어떤 사진이 제일 좋아?']);}

test('all migrations execute; outsiders cannot read, moderate or publish a request',async()=>{
 const f=await fixture();
 assert.equal(await scalar(outsider,'select count(*)::int from requests where id=$1',[f.id]),0);
 await assert.rejects(as(outsider,'select public.publish_request($1,$2)',[f.id,'안녕']),/Not allowed/);
 await assert.rejects(as(owner,'select public.complete_moderation($1,$2,$3,true)',[f.id,'제목',[f.photo]]),/permission denied/);
 await assert.rejects(as(owner,'select public.publish_request($1,$2)',[f.id,'어떤 사진이 제일 좋아?']),/Safety check/);
 assert.equal(await scalar(friend,'select public.preview_invite($1)',[f.token]),null);
 await approve(f);
 assert.equal(await scalar(friend,"select public.join_request($1,'친구')",[f.token]),f.id);
 assert.equal(await scalar(friend,'select count(*)::int from photos where request_id=$1',[f.id]),1);
 // Originals stay owner-only even after admission.
 assert.equal(await scalar(friend,"select count(*)::int from storage.objects where name like $1",[`${f.id}/original/%`]),0);
});
test('approval is bound to the exact photo set and title; direct uploads stop after sharing',async()=>{
 const f=await fixture();await db.query('select public.complete_moderation($1,$2,$3,true)',[f.id,'승인된 제목',[f.photo]]);
 await assert.rejects(as(owner,'select public.publish_request($1,$2)',[f.id,'다른 제목']),/Safety check/);
 await as(owner,'select public.publish_request($1,$2)',[f.id,'승인된 제목']);
 await assert.rejects(as(owner,"insert into storage.objects(bucket_id,name) values('request-photos',$1)",[`${f.id}/thumbnail/new.jpg`]),/row-level security/);
});
test('rotated/revoked invitations cannot admit users; confirmed requests reject new users',async()=>{
 const f=await fixture();await approve(f);
 const next=await scalar(owner,'select public.manage_invite($1,true)',[f.id]);assert.notEqual(next,f.token);
 await assert.rejects(as(friend,"select public.join_request($1,'친구')",[f.token]),/Invalid invite/);
 await as(friend,"select public.join_request($1,'친구')",[next]);
 await as(owner,'select public.manage_invite($1,false)',[f.id]);assert.equal(await scalar(outsider,'select public.preview_invite($1)',[next]),null);
 const finalToken=await scalar(owner,'select public.manage_invite($1,true)',[f.id]);
 await as(owner,'select public.confirm_request($1,$2)',[f.id,[f.photo]]);
 await assert.rejects(as(outsider,"select public.join_request($1,'새 친구')",[finalToken]),/unavailable/);
 assert.ok(await scalar(owner,'select confirmed_at from requests where id=$1',[f.id]));
});
test('reports are private; blocks revoke peer access while preserving the owners own photos',async()=>{
 const f=await fixture();await approve(f);await as(friend,"select public.join_request($1,'친구')",[f.token]);
 await assert.rejects(as(outsider,"select public.report_content($1,null,null,'other','')",[f.id]),/Not allowed/);
 assert.ok(await scalar(friend,"select public.report_content($1,$2,$3,'privacy','동의 없는 사진')",[f.id,f.photo,owner]));
 await assert.rejects(as(friend,'select * from private.reports'),/permission denied/);
 await as(friend,'select public.block_user($1,$2)',[f.id,owner]);
 assert.equal(await scalar(friend,'select count(*)::int from requests where id=$1',[f.id]),0);
 assert.equal(await scalar(owner,'select count(*)::int from requests where id=$1',[f.id]),1);
 await assert.rejects(as(friend,"select public.join_request($1,'친구')",[f.token]),/unavailable/);
 // Keep later scenarios independent while retaining the real block test above.
 await db.exec('delete from private.blocks');
});
test('deletion immediately revokes data access; job/data cleanup can be retried',async()=>{
 const f=await fixture();await approve(f);await as(friend,"select public.join_request($1,'친구')",[f.token]);
 await as(owner,'select public.begin_request_deletion($1)',[f.id]);
 assert.equal(await scalar(friend,'select count(*)::int from photos where request_id=$1',[f.id]),0);
 await db.query("select public.finish_cleanup_data($1,'request')",[f.id]);await db.query("select public.finish_cleanup_data($1,'request')",[f.id]);
 assert.equal((await db.query('select * from requests where id=$1',[f.id])).rows.length,0);
 await db.query("select public.complete_cleanup_job($1,'request')",[f.id]);
});
test('30-day retention enqueues deletion, never 29-day photos',async()=>{
 const a=await fixture(),b=await fixture();await approve(a);await approve(b);
 await as(owner,'select public.confirm_request($1,$2)',[a.id,[a.photo]]);await as(owner,'select public.confirm_request($1,$2)',[b.id,[b.photo]]);
 await db.query("update requests set confirmed_at=now()-interval '31 days' where id=$1",[a.id]);
 await db.query("update requests set confirmed_at=now()-interval '29 days' where id=$1",[b.id]);
 await db.exec('select public.enqueue_expired_requests()');
 assert.equal((await db.query('select deleted_at is not null as deleted from requests where id=$1',[a.id])).rows[0].deleted,true);
 assert.equal((await db.query('select deleted_at is null as kept from requests where id=$1',[b.id])).rows[0].kept,true);
});
test('safety checks require consent, reuse exact approvals and enforce an hourly cap',async()=>{
 const f=await fixture();
 await assert.rejects(db.query('select public.claim_safety_check($1,$2,$3)',[f.id,'제목','2026-10-22']),/Accept terms/);
 await as(owner,"select public.accept_terms('2026-10-22')");
 assert.equal((await db.query('select public.claim_safety_check($1,$2,$3) as needed',[f.id,'어떤 사진이 제일 좋아?','2026-10-22'])).rows[0].needed,true);
 await approve(f);
 assert.equal((await db.query('select public.claim_safety_check($1,$2,$3) as needed',[f.id,'어떤 사진이 제일 좋아?','2026-10-22'])).rows[0].needed,false);
 await assert.rejects(as(owner,'select public.claim_safety_check($1,$2,$3)',[f.id,'제목','2026-10-22']),/permission denied/);
 for(let i=0;i<29;i++)await db.query('select public.claim_safety_check($1,$2,$3)',[f.id,'다른 제목','2026-10-22']);
 await assert.rejects(db.query('select public.claim_safety_check($1,$2,$3)',[f.id,'다른 제목','2026-10-22']),/rate limited/);
});
test('account deletion blocks existing JWTs and cleans all FK references before Auth deletion',async()=>{
 const f=await fixture();await db.query("insert into private.bans(user_id,reason) values($1,'test restriction')",[owner]);
 assert.equal(await scalar(owner,'select public.account_status()'),'unavailable');
 // Restricted users retain the right to start account deletion.
 await as(owner,'select public.begin_account_deletion()');
 assert.equal(await scalar(owner,'select public.account_status()'),'deleting');
 assert.equal(await scalar(owner,'select count(*)::int from requests'),0);
 await assert.rejects(as(owner,"select public.create_simple_request('나')"),/unavailable/);
 await db.query("select public.finish_cleanup_data($1,'account')",[owner]);
 assert.equal((await db.query('select * from private.bans where user_id=$1',[owner])).rows.length,0);
 // Auth deletion may fail after DB cleanup; retries must retain the Storage prefixes.
 assert.ok((await db.query("select public.cleanup_request_ids($1,'account') as ids",[owner])).rows[0].ids.includes(f.id));
 await db.query('delete from auth.users where id=$1',[owner]);
 assert.equal(await scalar(owner,'select public.is_member($1)',[crypto.randomUUID()]),false);
 await db.query("select public.complete_cleanup_job($1,'account')",[owner]);
});
test('privileged worker RPCs cannot be called with a public client key',async()=>{
 for(const sql of ['select public.cleanup_jobs(null)',"select public.enqueue_expired_requests()",`select public.finish_cleanup_data('${friend}','account')`])await assert.rejects(as(friend,sql),/permission denied/);
});
