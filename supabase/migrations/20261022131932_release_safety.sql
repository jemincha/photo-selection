-- Private operational data is never exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.deleting_users(user_id uuid primary key,created_at timestamptz not null default now());
create table private.bans(user_id uuid primary key,reason text not null,created_at timestamptz not null default now());
create table private.blocks(user_id uuid not null,blocked_id uuid not null,created_at timestamptz not null default now(),primary key(user_id,blocked_id),check(user_id<>blocked_id));
create table private.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null,request_id uuid,photo_id uuid,target_id uuid,reason text not null check(reason in ('sexual','violence','harassment','privacy','other')),details text not null default '' check(length(details)<=500),status text not null default 'open' check(status in ('open','reviewing','resolved')),created_at timestamptz not null default now());
create table private.cleanup_jobs(id uuid,kind text not null check(kind in ('request','account')),request_ids uuid[] not null default '{}',created_at timestamptz not null default now(),primary key(kind,id));
create table private.consents(user_id uuid primary key,terms_version text,share_version text,updated_at timestamptz not null default now());
create table private.safety_attempts(user_id uuid not null,created_at timestamptz not null default now());
create index safety_attempts_user_time on private.safety_attempts(user_id,created_at);

alter table public.requests add column invite_enabled boolean not null default true;
alter table public.requests add column deleted_at timestamptz;
alter table public.requests add column confirmed_at timestamptz;
alter table public.requests add column moderation_state text not null default 'pending' check(moderation_state in ('pending','approved','rejected'));
alter table public.requests add column moderation_title text;
alter table public.requests add column moderation_photos uuid[];
update public.requests set confirmed_at=now() where status='confirmed';

create function private.active_user(uid uuid) returns boolean language sql stable security definer set search_path=public,private as $$
 select uid is not null and exists(select 1 from auth.users where id=uid)
 and not exists(select 1 from private.deleting_users where user_id=uid)
 and not exists(select 1 from private.bans where user_id=uid);
$$;
create function private.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public,private as $$
 select exists(select 1 from private.blocks where (user_id=a and blocked_id=b) or (user_id=b and blocked_id=a));
$$;
create or replace function public.is_member(rid uuid) returns boolean language sql stable security definer set search_path=public,private as $$
 select private.active_user(auth.uid()) and exists(
 select 1 from members m join requests r on r.id=m.request_id where m.request_id=rid and m.user_id=auth.uid()
 and r.deleted_at is null and (r.confirmed_at is null or r.confirmed_at>now()-interval '30 days') and private.active_user(r.owner_id)
 and (r.owner_id=auth.uid() or r.moderation_state='approved')
 and (r.owner_id=auth.uid() or not exists(select 1 from members peer where peer.request_id=rid and private.blocked(auth.uid(),peer.user_id))));
$$;
create or replace function public.is_album_member(aid uuid) returns boolean language sql stable security definer set search_path=public,private as $$
 select private.active_user(auth.uid()) and exists(select 1 from album_members where album_id=aid and user_id=auth.uid())
 and (exists(select 1 from requests r where r.album_id=aid and r.owner_id=auth.uid() and r.deleted_at is null) or not exists(select 1 from album_members peer where peer.album_id=aid and private.blocked(auth.uid(),peer.user_id)));
$$;
create function public.account_status() returns text language sql stable security definer set search_path=public,private as $$
 select case when exists(select 1 from private.deleting_users where user_id=auth.uid()) then 'deleting'
 when not private.active_user(auth.uid()) then 'unavailable' else 'active' end;
$$;
create function public.accept_terms(p_version text) returns void language plpgsql security definer set search_path=public,private as $$
begin
 if not private.active_user(auth.uid()) or p_version<>'2026-10-22' then raise exception 'Invalid consent';end if;
 insert into private.consents(user_id,terms_version) values(auth.uid(),p_version) on conflict(user_id) do update set terms_version=excluded.terms_version,updated_at=now();
end $$;
create function public.claim_safety_check(p_request uuid,p_title text,p_version text) returns boolean language plpgsql security definer set search_path=public,private as $$
declare r requests;ids uuid[];
begin
 select * into r from requests where id=p_request for update;
 if not found or not private.active_user(r.owner_id) or r.deleted_at is not null or p_version<>'2026-10-22' then raise exception 'Not allowed';end if;
 if not exists(select 1 from private.consents where user_id=r.owner_id and terms_version=p_version) then raise exception 'Accept terms before sharing';end if;
 select array_agg(id order by id) into ids from photos where request_id=r.id;
 insert into private.consents(user_id,share_version) values(r.owner_id,p_version) on conflict(user_id) do update set share_version=excluded.share_version,updated_at=now();
 if r.moderation_state='approved' and r.moderation_title=trim(p_title) and r.moderation_photos=ids then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(r.owner_id::text,0));
 if (select count(*) from private.safety_attempts where user_id=r.owner_id and created_at>now()-interval '1 hour')>=30 then raise exception 'Safety check rate limited';end if;
 insert into private.safety_attempts(user_id) values(r.owner_id);return true;
end $$;
-- A common guard covers old clients/RPCs as well as the new UI.
create function public.guard_request_write() returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if current_setting('role',true) in ('authenticated','anon') then
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if not private.active_user(auth.uid()) or (tg_op='UPDATE' and old.deleted_at is not null) then raise exception 'Account or request unavailable';end if;
  if tg_op='INSERT' and new.owner_id is distinct from auth.uid() then raise exception 'Not allowed';end if;
 end if;
 if tg_op='UPDATE' and new.status='confirmed' and old.status<>'confirmed' then new.confirmed_at=now();end if;
 return new;
end $$;
create trigger request_write_guard before insert or update on public.requests for each row execute function public.guard_request_write();
create function public.guard_album_write() returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if current_setting('role',true) in ('authenticated','anon') and not private.active_user(auth.uid()) then raise exception 'Account unavailable';end if;
 return new;
end $$;
create trigger album_write_guard before insert on public.albums for each row execute function public.guard_album_write();
revoke execute on function public.guard_album_write() from public,anon,authenticated;

create or replace function public.publish_request(p_request uuid,p_title text) returns void language plpgsql security definer set search_path=public,private as $$
declare r requests;ids uuid[];
begin
 select * into r from requests where id=p_request for update;
 if not found or r.owner_id is distinct from auth.uid() or not public.is_member(r.id) or r.status<>'selecting' then raise exception 'Not allowed';end if;
 if length(trim(p_title)) not between 1 and 60 then raise exception 'Invalid title';end if;
 select array_agg(id order by id) into ids from photos where request_id=r.id;
 if ids is null or cardinality(ids)>30 then raise exception 'Prepare 1 to 30 photos';end if;
 if r.moderation_state<>'approved' or r.moderation_title is distinct from trim(p_title) or r.moderation_photos is distinct from ids then raise exception 'Safety check required';end if;
 update requests set title=trim(p_title),published_at=coalesce(published_at,now()) where id=r.id;
end $$;
create function public.complete_moderation(p_request uuid,p_title text,p_photos uuid[],p_approved boolean) returns void language plpgsql security definer set search_path=public,private as $$
declare r requests;ids uuid[];
begin
 select * into r from requests where id=p_request for update;
 if not found or r.deleted_at is not null then raise exception 'Request unavailable';end if;
 select array_agg(id order by id) into ids from photos where request_id=r.id;
 if ids is distinct from p_photos then raise exception 'Photos changed during safety check';end if;
 update requests set moderation_state=case when p_approved then 'approved' else 'rejected' end,moderation_title=trim(p_title),moderation_photos=ids where id=r.id;
end $$;

create or replace function public.preview_invite(p_token uuid) returns jsonb language sql stable security definer set search_path=public,private as $$
 select jsonb_build_object('title',r.title,'status',r.status,'owner',m.nickname,'simple',r.simple,'photoCount',(select count(*) from photos p where p.request_id=r.id))
 from requests r join members m on m.request_id=r.id and m.user_id=r.owner_id
 where r.invite_token=p_token and r.invite_enabled and r.deleted_at is null and r.moderation_state='approved'
 and private.active_user(auth.uid()) and private.active_user(r.owner_id)
 and (not r.simple or r.published_at is not null) and (r.status='selecting' or public.is_member(r.id))
 and not exists(select 1 from album_members peer where peer.album_id=r.album_id and private.blocked(auth.uid(),peer.user_id));
$$;
create or replace function public.join_request(p_token uuid,p_nickname text) returns uuid language plpgsql security definer set search_path=public,private as $$
declare r requests;
begin
 if not private.active_user(auth.uid()) or length(trim(p_nickname)) not between 1 and 20 then raise exception 'Invalid participant';end if;
 select * into r from requests where invite_token=p_token;
 if not found then raise exception 'Invalid invite';end if;
 perform 1 from albums where id=r.album_id for update;
 -- Recheck the token after locking: rotation/revocation may have won the race.
 select * into r from requests where invite_token=p_token for update;
 if not found or public.preview_invite(p_token) is null then raise exception 'Invite unavailable';end if;
 if not public.is_album_member(r.album_id) and (select count(*) from album_members where album_id=r.album_id)>=3 then raise exception 'Album is full';end if;
 insert into album_members values(r.album_id,auth.uid(),trim(p_nickname)) on conflict(album_id,user_id) do update set nickname=excluded.nickname;
 insert into members select id,auth.uid(),trim(p_nickname) from requests where album_id=r.album_id and deleted_at is null on conflict(request_id,user_id) do update set nickname=excluded.nickname;
 return r.id;
end $$;
create function public.manage_invite(p_request uuid,p_enabled boolean) returns uuid language plpgsql security definer set search_path=public,private as $$
declare r requests;token uuid;
begin
 select * into r from requests where id=p_request;
 perform 1 from albums where id=r.album_id for update;
 select * into r from requests where id=p_request for update;
 if r.owner_id is distinct from auth.uid() or not public.is_member(p_request) then raise exception 'Not allowed';end if;
 token:=gen_random_uuid();update requests set invite_token=token,invite_enabled=p_enabled where id=p_request;return token;
end $$;
create function public.block_user(p_request uuid,p_user uuid) returns void language plpgsql security definer set search_path=public,private as $$
begin
 if not public.is_member(p_request) or p_user=auth.uid() or not exists(select 1 from members where request_id=p_request and user_id=p_user) then raise exception 'Not allowed';end if;
 insert into private.blocks(user_id,blocked_id) values(auth.uid(),p_user) on conflict do nothing;
end $$;
create function public.report_content(p_request uuid,p_photo uuid,p_target uuid,p_reason text,p_details text) returns uuid language plpgsql security definer set search_path=public,private as $$
declare rid uuid;
begin
 if not public.is_member(p_request) then raise exception 'Not allowed';end if;
 if p_photo is not null and not exists(select 1 from photos where id=p_photo and request_id=p_request) then raise exception 'Invalid photo';end if;
 if p_target is not null and not exists(select 1 from members where request_id=p_request and user_id=p_target) then raise exception 'Invalid participant';end if;
 if (select count(*) from private.reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Please try again later';end if;
 insert into private.reports(reporter_id,request_id,photo_id,target_id,reason,details) values(auth.uid(),p_request,p_photo,p_target,p_reason,trim(p_details)) returning id into rid;
 return rid;
end $$;
create function public.begin_request_deletion(p_request uuid) returns void language plpgsql security definer set search_path=public,private as $$
begin
 perform 1 from requests where id=p_request for update;
 if not private.active_user(auth.uid()) or not exists(select 1 from requests where id=p_request and owner_id=auth.uid()) then raise exception 'Not allowed';end if;
 update requests set deleted_at=now(),invite_enabled=false,invite_token=gen_random_uuid() where id=p_request;
 insert into private.cleanup_jobs(id,kind) values(p_request,'request') on conflict do nothing;
end $$;
create function public.begin_account_deletion() returns void language plpgsql security definer set search_path=public,private as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then raise exception 'Not allowed';end if;
 insert into private.deleting_users(user_id) values(auth.uid()) on conflict do nothing;
 insert into private.cleanup_jobs(id,kind,request_ids) values(auth.uid(),'account',array(select id from public.requests where owner_id=auth.uid())) on conflict do nothing;
end $$;
-- Worker-only RPCs: Storage API deletion must finish before relational data goes away.
create function public.cleanup_jobs(p_user uuid default null) returns jsonb language sql security definer set search_path=public,private as $$
 select coalesce(jsonb_agg(to_jsonb(j)),'[]') from (select * from private.cleanup_jobs where p_user is null or (kind='account' and id=p_user) or (kind='request' and id in(select id from requests where owner_id=p_user)) order by created_at limit 20) j;
$$;
create function public.cleanup_request_ids(p_id uuid,p_kind text) returns uuid[] language sql security definer set search_path=public,private as $$
 select coalesce(array_agg(distinct rid),'{}') from (
  select id rid from requests where (p_kind='account' and owner_id=p_id) or (p_kind='request' and id=p_id)
  union select unnest(request_ids) from private.cleanup_jobs where id=p_id and kind=p_kind
  union select p_id where p_kind='request'
 ) retained;
$$;
create function public.finish_cleanup_data(p_id uuid,p_kind text) returns void language plpgsql security definer set search_path=public,private as $$
begin
 if not exists(select 1 from private.cleanup_jobs where id=p_id and kind=p_kind) then raise exception 'Unknown deletion job';end if;
 if p_kind='account' then
  delete from public.requests where owner_id=p_id;
  delete from public.reactions where user_id=p_id;
  delete from public.comments where user_id=p_id;
  delete from public.submissions where user_id=p_id;
  delete from public.members where user_id=p_id;
  delete from public.album_members where user_id=p_id;
  delete from private.blocks where user_id=p_id or blocked_id=p_id;
  delete from private.bans where user_id=p_id;
  delete from private.reports where reporter_id=p_id or target_id=p_id;
  delete from private.consents where user_id=p_id;
  delete from private.safety_attempts where user_id=p_id;
 else delete from public.requests where id=p_id;end if;
 delete from public.albums a where not exists(select 1 from requests r where r.album_id=a.id) and not exists(select 1 from album_members m where m.album_id=a.id);
end $$;
create function public.complete_cleanup_job(p_id uuid,p_kind text) returns void language sql security definer set search_path=public,private as $$
 delete from private.cleanup_jobs where id=p_id and kind=p_kind;
$$;
create function public.enqueue_expired_requests() returns integer language plpgsql security definer set search_path=public,private as $$
declare n integer;
begin
 with expired as (update requests set deleted_at=now(),invite_enabled=false where confirmed_at<now()-interval '30 days' and deleted_at is null returning id)
 insert into private.cleanup_jobs(id,kind) select id,'request' from expired on conflict do nothing;
 get diagnostics n=row_count;
 delete from private.reports where created_at<now()-interval '90 days';
 delete from private.safety_attempts where created_at<now()-interval '1 day';
 delete from private.deleting_users where created_at<now()-interval '90 days' and not exists(select 1 from auth.users where id=user_id);
 return n;
end $$;
-- Check the complete set at read time, including old clients and shared legacy albums.
create or replace function public.guard_simple_photo_insert() returns trigger language plpgsql security definer set search_path=public,private as $$
declare r requests;
begin
 select * into r from requests where id=new.request_id for update;
 if not public.is_member(r.id) or r.owner_id is distinct from auth.uid() or r.status<>'selecting' or (r.simple and r.published_at is not null) then raise exception 'Photos cannot change';end if;
 if (select count(*) from photos where request_id=r.id)>=30 then raise exception 'Maximum 30 photos';end if;
 if new.byte_size not between 1 and 26214400 or new.width<=0 or new.height<=0 or new.mime_type not in ('image/jpeg','image/png','image/heic','image/heif','image/webp') then raise exception 'Invalid photo';end if;
 update requests set moderation_state='pending',moderation_photos=null,moderation_title=null where id=r.id;
 return new;
end $$;
drop policy storage_upload on storage.objects;
create policy storage_upload on storage.objects for insert to authenticated with check(
 bucket_id='request-photos' and exists(select 1 from public.requests r where r.id::text=(storage.foldername(name))[1]
 and public.is_member(r.id) and r.owner_id=auth.uid() and r.status='selecting' and (not r.simple or r.published_at is null))
 and (storage.foldername(name))[2] in ('original','thumbnail'));

-- Explicitly deny default PUBLIC execution on every new privileged entry point.
revoke all on all functions in schema private from public,anon,authenticated;
revoke execute on function public.account_status(),public.guard_request_write(),public.complete_moderation(uuid,text,uuid[],boolean),public.manage_invite(uuid,boolean),public.block_user(uuid,uuid),public.report_content(uuid,uuid,uuid,text,text),public.begin_request_deletion(uuid),public.begin_account_deletion(),public.cleanup_jobs(uuid),public.cleanup_request_ids(uuid,text),public.finish_cleanup_data(uuid,text),public.complete_cleanup_job(uuid,text),public.enqueue_expired_requests() from public,anon,authenticated;
grant execute on function public.account_status(),public.manage_invite(uuid,boolean),public.block_user(uuid,uuid),public.report_content(uuid,uuid,uuid,text,text),public.begin_request_deletion(uuid),public.begin_account_deletion() to authenticated;
grant execute on function public.complete_moderation(uuid,text,uuid[],boolean),public.cleanup_jobs(uuid),public.cleanup_request_ids(uuid,text),public.finish_cleanup_data(uuid,text),public.complete_cleanup_job(uuid,text),public.enqueue_expired_requests() to service_role;
revoke execute on function public.accept_terms(text),public.claim_safety_check(uuid,text,text) from public,anon,authenticated;
grant execute on function public.accept_terms(text) to authenticated;
grant execute on function public.claim_safety_check(uuid,text,text) to service_role;
-- V2 uses classifications only. Historical comments remain readable; free-text posting is retired.
revoke execute on function public.add_comment(uuid,uuid,text) from authenticated;
alter table private.deleting_users enable row level security;
alter table private.bans enable row level security;
alter table private.blocks enable row level security;
alter table private.reports enable row level security;
alter table private.cleanup_jobs enable row level security;
alter table private.consents enable row level security;
alter table private.safety_attempts enable row level security;
