-- Additive v2 contract. Existing albums/requests retain their legacy behavior.
alter table public.requests add column simple boolean not null default false;
alter table public.requests add column published_at timestamptz;

create function public.create_simple_request(p_nickname text) returns uuid
language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 rid:=public.create_request('어떤 사진이 제일 좋아?',p_nickname);
 update requests set simple=true where id=rid;
 return rid;
end $$;

create function public.publish_request(p_request uuid,p_title text) returns void
language plpgsql security definer set search_path=public as $$
declare r requests;
begin
 select * into r from requests where id=p_request for update;
 if not found or r.owner_id is distinct from auth.uid() or r.status<>'selecting' then raise exception 'Not allowed';end if;
 if r.published_at is not null then return;end if;
 if not exists(select 1 from photos where request_id=r.id) then raise exception 'Prepare photos before sharing';end if;
 if length(trim(p_title)) not between 1 and 60 then raise exception 'Invalid title';end if;
 update requests set title=trim(p_title),published_at=now() where id=r.id;
end $$;

create or replace function public.create_album_request(p_album uuid,p_title text,p_nickname text) returns uuid
language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 perform 1 from albums where id=p_album for update;
 if not public.is_album_member(p_album) then raise exception 'Album membership required';end if;
 if exists(select 1 from requests where album_id=p_album and simple) then raise exception 'Create a new selection instead';end if;
 update album_members set nickname=trim(p_nickname) where album_id=p_album and user_id=auth.uid();
 insert into requests(owner_id,title,album_id) values(auth.uid(),trim(p_title),p_album) returning id into rid;
 insert into members select rid,user_id,nickname from album_members where album_id=p_album;
 return rid;
end $$;

create or replace function public.preview_invite(p_token uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('title',r.title,'status',r.status,'owner',m.nickname,'simple',r.simple,'photoCount',(select count(*) from photos p where p.request_id=r.id))
 from requests r join members m on m.request_id=r.id and m.user_id=r.owner_id
 where r.invite_token=p_token and (not r.simple or r.published_at is not null);
$$;

create or replace function public.join_request(p_token uuid,p_nickname text) returns uuid
language plpgsql security definer set search_path=public as $$
declare r requests;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into r from requests where invite_token=p_token;
 if not found or (r.simple and r.published_at is null) then raise exception 'Invalid invite';end if;
 -- Album lock serializes all admissions, including legacy invitations.
 perform 1 from albums where id=r.album_id for update;
 select * into r from requests where id=r.id for update;
 if r.simple and r.status='confirmed' and not public.is_member(r.id) then raise exception 'Selection ended';end if;
 if not public.is_album_member(r.album_id) and (select count(*) from album_members where album_id=r.album_id)>=3 then raise exception 'Album is full';end if;
 insert into album_members values(r.album_id,auth.uid(),trim(p_nickname)) on conflict(album_id,user_id) do update set nickname=excluded.nickname;
 insert into members select id,auth.uid(),trim(p_nickname) from requests where album_id=r.album_id on conflict(request_id,user_id) do update set nickname=excluded.nickname;
 return r.id;
end $$;

-- Lock the same request as publish/confirm, so a racing upload cannot change a shared set.
create function public.guard_simple_photo_insert() returns trigger
language plpgsql security definer set search_path=public as $$
declare r requests;
begin
 select * into r from requests where id=new.request_id for update;
 if r.status<>'selecting' or (r.simple and r.published_at is not null) then raise exception 'Shared photos cannot change';end if;
 if new.byte_size not between 1 and 26214400 or new.width<=0 or new.height<=0 then raise exception 'Invalid photo';end if;
 return new;
end $$;
create trigger guard_simple_photo before insert on public.photos for each row execute function public.guard_simple_photo_insert();

drop policy storage_upload on storage.objects;
create policy storage_upload on storage.objects for insert to authenticated with check(
 bucket_id='request-photos' and exists(select 1 from public.requests r where r.id::text=(storage.foldername(name))[1]
 and r.owner_id=auth.uid() and r.status='selecting' and (not r.simple or r.published_at is null))
 and (storage.foldername(name))[2] in ('original','thumbnail'));

revoke execute on function public.create_simple_request(text),public.publish_request(uuid,text),public.guard_simple_photo_insert() from public,anon;
grant execute on function public.create_simple_request(text),public.publish_request(uuid,text) to authenticated;
