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
test('100 photos can be shared and reviewed after confirmation; a 101st photo is rejected by the locked server guard',async()=>{
 const f=await fixture(),ids=[f.photo];
 for(let i=1;i<100;i++){
  const photo=crypto.randomUUID(),filename=`${photo}.jpg`;ids.push(photo);
  await as(owner,'insert into storage.objects(bucket_id,name) values($1,$2),($1,$3)',['request-photos',`${f.id}/original/${photo}/${filename}`,`${f.id}/thumbnail/${photo}.jpg`]);
  await as(owner,'select public.register_photo($1,$2,$3,$4,100,100,10,$5)',[photo,f.id,filename,'image/jpeg','a'.repeat(64)]);
 }
 const overflow=crypto.randomUUID();
 await as(owner,'insert into storage.objects(bucket_id,name) values($1,$2),($1,$3)',['request-photos',`${f.id}/original/${overflow}/${overflow}.jpg`,`${f.id}/thumbnail/${overflow}.jpg`]);
 await assert.rejects(as(owner,'select public.register_photo($1,$2,$3,$4,100,100,10,$5)',[overflow,f.id,`${overflow}.jpg`,'image/jpeg','a'.repeat(64)]),/Maximum 100/);
 await db.query('select public.complete_moderation($1,$2,$3,true)',[f.id,'100장',[...ids].sort()]);
 await as(owner,'select public.publish_request($1,$2)',[f.id,'100장']);await as(friend,"select public.join_request($1,'친구')",[f.token]);
 await as(friend,'select public.set_reaction($1,$2)',[ids[30],'unsure']);
 await as(owner,'select public.confirm_request($1,$2)',[f.id,ids.slice(0,20)]);
 assert.equal(await scalar(friend,'select count(*)::int from photos where request_id=$1',[f.id]),100);
 assert.equal(await scalar(friend,'select value from reactions where photo_id=$1',[ids[30]]),'unsure');
 assert.equal(await scalar(outsider,'select count(*)::int from photos where request_id=$1',[f.id]),0);
 await assert.rejects(as(friend,'select public.set_reaction($1,$2)',[ids[30],'like']),/Not allowed/);
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
test('shared events keep participant uploads together and collection references enforce event membership',async()=>{
 const id=await scalar(owner,"select public.create_event('A')"),photo=crypto.randomUUID(),filename=`${photo}.jpg`;
 const album=await scalar(owner,'select album_id from requests where id=$1',[id]);
 assert.equal(await scalar(owner,'select simple from requests where id=$1',[id]),false);
 await as(owner,'insert into storage.objects(bucket_id,name) values($1,$2),($1,$3)',['request-photos',`${id}/original/${photo}/${filename}`,`${id}/thumbnail/${photo}.jpg`]);
 await as(owner,'select public.register_photo($1,$2,$3,$4,100,100,10,$5)',[photo,id,filename,'image/jpeg','a'.repeat(64)]);
 const token=await scalar(owner,'select invite_token from requests where id=$1',[id]);await approve({id,photo});await as(friend,"select public.join_request($1,'B')",[token]);
 const second=await scalar(friend,"select public.create_album_request($1,'B의 사진','B')",[album]);assert.equal(await scalar(friend,'select album_id from requests where id=$1',[second]),album);
 await as(friend,"update albums set title='우리 여행' where id=$1",[album]);assert.equal(await scalar(owner,'select title from albums where id=$1',[album]),'우리 여행');
 await as(friend,'insert into album_photo_sections values($1,$2,$3) on conflict do nothing',[album,friend,photo]);
 await as(friend,'insert into album_photo_sections values($1,$2,$3) on conflict do nothing',[album,friend,photo]);
 assert.equal(await scalar(owner,'select count(*)::int from album_photo_sections where album_id=$1',[album]),1);
 assert.equal(await scalar(owner,'select request_id from photos where id=$1',[photo]),id);
 assert.equal(await scalar(friend,"select count(*)::int from storage.objects where name like $1",[`${id}/original/%`]),0);
 await assert.rejects(as(owner,'insert into album_photo_sections values($1,$2,$3)',[album,friend,photo]),/row-level security/);
 await assert.rejects(as(outsider,'insert into album_photo_sections values($1,$2,$3)',[album,outsider,photo]),/row-level security/);
 const other=await scalar(friend,"select public.create_event('B')"),otherAlbum=await scalar(friend,'select album_id from requests where id=$1',[other]);
 await assert.rejects(as(friend,'insert into album_photo_sections values($1,$2,$3)',[otherAlbum,friend,photo]),/row-level security/);
 await as(owner,'delete from album_photo_sections where album_id=$1',[album]);assert.equal(await scalar(friend,'select count(*)::int from album_photo_sections where album_id=$1',[album]),1);
 await as(friend,'delete from album_photo_sections where album_id=$1',[album]);assert.equal(await scalar(friend,'select count(*)::int from album_photo_sections where album_id=$1',[album]),0);
 await as(friend,'insert into album_photo_sections values($1,$2,$3)',[album,friend,photo]);
 await as(friend,'select public.block_user($1,$2)',[id,owner]);assert.equal(await scalar(friend,'select count(*)::int from album_photo_sections where album_id=$1',[album]),0);
 await db.exec('delete from private.blocks');
 await as(owner,'select public.begin_request_deletion($1)',[id]);assert.equal(await scalar(friend,'select count(*)::int from album_photo_sections where album_id=$1',[album]),0);
 await db.query("select public.finish_cleanup_data($1,'request')",[id]);assert.equal((await db.query('select * from album_photo_sections where photo_id=$1',[photo])).rows.length,0);
});

async function eventFixture(uid=owner){
 const id=await scalar(uid,"select public.create_event('사진 주인')"),photo=crypto.randomUUID(),filename=`${photo}.jpg`;
 await as(uid,'insert into storage.objects(bucket_id,name) values($1,$2),($1,$3)',['request-photos',`${id}/original/${photo}/${filename}`,`${id}/thumbnail/${photo}.jpg`]);
 await as(uid,'select public.register_photo($1,$2,$3,$4,100,100,10,$5)',[photo,id,filename,'image/jpeg','a'.repeat(64)]);
 await db.query('select public.complete_moderation($1,$2,$3,true)',[id,'공유 사진',[photo]]);await as(uid,'select public.publish_request($1,$2)',[id,'공유 사진']);
 return {id,photo,album:await scalar(uid,'select album_id from requests where id=$1',[id]),token:await scalar(uid,'select invite_token from requests where id=$1',[id])};
}
test('friend profiles persist after shared event deletion and direct invitations require the recipient to accept',async()=>{
 const old=await eventFixture();await as(friend,"select public.join_request($1,'B')",[old.token]);
 assert.ok(await scalar(owner,'select exists(select 1 from friend_profiles where friend_id=$1)',[friend]));
 assert.equal(await scalar(outsider,'select count(*)::int from friend_profiles'),0);
 await assert.rejects(as(owner,"insert into friend_profiles values($1,$2,'위조')",[owner,outsider]),/permission denied/);
 await as(owner,'select public.begin_request_deletion($1)',[old.id]);await db.query("select public.finish_cleanup_data($1,'request')",[old.id]);
 assert.ok(await scalar(owner,'select exists(select 1 from friend_profiles where friend_id=$1)',[friend]));
 const f=await eventFixture();await assert.rejects(as(outsider,'select public.invite_event_friend($1,$2)',[f.album,friend]),/Not allowed/);
 await as(owner,'select public.invite_event_friend($1,$2)',[f.album,friend]);await as(owner,'select public.invite_event_friend($1,$2)',[f.album,friend]);
 const rows=(await as(friend,"select * from event_invitations where album_id=$1 and status='pending'",[f.album])).rows;assert.equal(rows.length,1);
 assert.equal(await scalar(friend,'select count(*)::int from photos where request_id=$1',[f.id]),0);
 await assert.rejects(as(owner,"select public.respond_event_invite($1,true,'위조')",[rows[0].id]),/Invalid invitation/);
 await as(friend,"select public.respond_event_invite($1,true,'B')",[rows[0].id]);assert.equal(await scalar(friend,'select count(*)::int from photos where request_id=$1',[f.id]),1);
 await as(friend,'select public.block_user($1,$2)',[f.id,owner]);assert.equal(await scalar(friend,'select count(*)::int from friend_profiles where friend_id=$1',[owner]),0);await db.exec('delete from private.blocks');
});
test('self voting is rejected and completion waits for every upload batch before archiving',async()=>{
 const f=await eventFixture();await as(friend,"select public.join_request($1,'B')",[f.token]);
 await assert.rejects(as(owner,"select public.set_reaction($1,'like')",[f.photo]),/Self voting/);
 await db.query("insert into reactions values($1,$2,'like')",[f.photo,owner]);
 await assert.rejects(as(owner,'select public.submit_selection($1)',[f.id]),/Self voting/);
 await as(friend,"select public.set_reaction($1,'unsure')",[f.photo]);await as(friend,'select public.submit_selection($1)',[f.id]);
 const second=await scalar(friend,"select public.create_album_request($1,'B의 사진','B')",[f.album]);
 await as(owner,'select public.confirm_request($1,$2)',[f.id,[f.photo]]);assert.equal(await scalar(owner,'select completed_at from albums where id=$1',[f.album]),null);
 const photo=crypto.randomUUID();await as(friend,'insert into storage.objects(bucket_id,name) values($1,$2),($1,$3)',['request-photos',`${second}/original/${photo}/${photo}.jpg`,`${second}/thumbnail/${photo}.jpg`]);
 await as(friend,'select public.register_photo($1,$2,$3,$4,100,100,10,$5)',[photo,second,`${photo}.jpg`,'image/jpeg','a'.repeat(64)]);
 await db.query('select public.complete_moderation($1,$2,$3,true)',[second,'B의 사진',[photo]]);await as(friend,"select public.publish_request($1,'B의 사진')",[second]);
 await as(friend,'select public.confirm_request($1,$2)',[second,[photo]]);assert.ok(await scalar(owner,'select completed_at from albums where id=$1',[f.album]));
 await assert.rejects(as(owner,"select public.create_album_request($1,'추가','A')",[f.album]),/Event closed/);
});
test('friend invitation admission rechecks capacity and closure cancels pending invitations',async()=>{
 const f=await eventFixture(),fourth=crypto.randomUUID();await db.query('insert into auth.users values($1)',[fourth]);
 await as(owner,'select public.invite_event_friend($1,$2)',[f.album,friend]);
 const invitation=await scalar(friend,"select id from event_invitations where album_id=$1 and status='pending'",[f.album]);
 await assert.rejects(as(friend,"insert into event_invitations(album_id,inviter_id,invitee_id,title,inviter_name) values($1,$2,$3,'위조','위조')",[f.album,owner,friend]),/permission denied/);
 await as(outsider,"select public.join_request($1,'C')",[f.token]);await as(fourth,"select public.join_request($1,'D')",[f.token]);
 await assert.rejects(as(friend,"select public.respond_event_invite($1,true,'B')",[invitation]),/Album is full/);
 assert.equal(await scalar(friend,'select status from event_invitations where id=$1',[invitation]),'pending');
 await as(owner,'select public.close_event($1)',[f.album]);assert.equal(await scalar(friend,'select status from event_invitations where id=$1',[invitation]),'declined');
 await assert.rejects(as(friend,"select public.respond_event_invite($1,true,'B')",[invitation]),/Invalid invitation/);
});
test('manual closure is creator-only and stops uploads, votes and link admission',async()=>{
 const f=await eventFixture();await as(friend,"select public.join_request($1,'B')",[f.token]);
 await assert.rejects(as(friend,'select public.close_event($1)',[f.album]),/Not allowed/);await as(owner,'select public.close_event($1)',[f.album]);
 assert.ok(await scalar(owner,'select closed_at from albums where id=$1',[f.album]));
 await assert.rejects(as(friend,"select public.set_reaction($1,'like')",[f.photo]),/Not allowed/);
 await assert.rejects(as(outsider,"select public.join_request($1,'C')",[f.token]),/Event closed/);
 await assert.rejects(as(owner,"insert into storage.objects(bucket_id,name) values('request-photos',$1)",[`${f.id}/thumbnail/new.jpg`]),/row-level security/);
 await as(owner,'select public.begin_request_deletion($1)',[f.id]);
});

test('support tickets are private, validated and rate limited per signed-in user',async()=>{
 await assert.rejects(as(owner,"select public.submit_feedback('bug','짧음')"),/Invalid feedback/);
 await assert.rejects(as(owner,"select public.submit_feedback('other','충분히 긴 피드백')"),/Invalid feedback/);
 const id=await scalar(owner,"select public.submit_feedback('bug','  사진이 로딩되지 않아요  ')");
 assert.equal((await db.query('select body from private.support_feedback where id=$1',[id])).rows[0].body,'사진이 로딩되지 않아요');
 await assert.rejects(as(friend,'select * from private.support_feedback'),/permission denied/);
 for(let i=1;i<10;i++)await as(owner,"select public.submit_feedback('suggestion','사진 순서를 바꾸고 싶어요')");
 await assert.rejects(as(owner,"select public.submit_feedback('bug','다시 보내는 피드백')"),/rate limited/);
 await as(friend,"select public.submit_feedback('suggestion','친구의 제안사항입니다')");
});

test('history reset deletes own uploads and participation while keeping identity, friends and peer photos',async()=>{
 const own=await eventFixture(),peer=await eventFixture(friend);
 await as(friend,"select public.join_request($1,'B')",[own.token]);
 await as(owner,"select public.join_request($1,'A')",[peer.token]);
 await as(owner,"select public.set_reaction($1,'like')",[peer.photo]);
 await as(owner,'select public.submit_selection($1)',[peer.id]);
 await as(owner,'select public.clear_event_history()');await as(owner,'select public.clear_event_history()');
 assert.equal(await scalar(owner,'select public.account_status()'),'active');
 assert.ok((await db.query('select id from auth.users where id=$1',[owner])).rows.length);
 assert.ok(await scalar(owner,'select exists(select 1 from friend_profiles where friend_id=$1)',[friend]));
 assert.equal(await scalar(owner,'select count(*)::int from albums'),0);
 assert.equal(await scalar(owner,'select count(*)::int from requests'),0);
 assert.ok((await db.query('select deleted_at from requests where id=$1',[own.id])).rows[0].deleted_at);
 assert.equal((await db.query("select count(*)::int n from private.cleanup_jobs where id=$1 and kind='request'",[own.id])).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from reactions where user_id=$1',[owner])).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from submissions where user_id=$1',[owner])).rows[0].n,0);
 assert.equal(await scalar(friend,'select count(*)::int from photos where id=$1',[peer.photo]),1);
 await db.query("select public.finish_cleanup_data($1,'request')",[own.id]);
 assert.equal((await db.query('select count(*)::int n from photos where request_id=$1',[own.id])).rows[0].n,0);
 assert.equal(await scalar(friend,'select count(*)::int from photos where id=$1',[peer.photo]),1);
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
