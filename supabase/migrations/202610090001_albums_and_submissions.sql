-- Apply after 202610080001_mvp.sql. Existing requests become individual albums.
create table public.albums(id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 1 and 60),created_at timestamptz not null default now());
create table public.album_members(album_id uuid references public.albums(id) on delete cascade,user_id uuid references auth.users(id),nickname text not null check(length(nickname) between 1 and 20),primary key(album_id,user_id));
alter table public.requests add column album_id uuid references public.albums(id);
insert into public.albums(id,title,created_at) select id,title,created_at from public.requests;
update public.requests set album_id=id;
insert into public.album_members select request_id,user_id,nickname from public.members;
alter table public.requests alter column album_id set not null;
create index requests_album_idx on public.requests(album_id);
create table public.submissions(request_id uuid references public.requests(id) on delete cascade,user_id uuid references auth.users(id),selected_ids uuid[] not null default '{}',created_at timestamptz not null default now(),primary key(request_id,user_id));
create function public.is_album_member(aid uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from album_members where album_id=aid and user_id=auth.uid())$$;
alter table public.albums enable row level security;
alter table public.album_members enable row level security;
alter table public.submissions enable row level security;
create policy album_read on public.albums for select to authenticated using(public.is_album_member(id));
create policy album_member_read on public.album_members for select to authenticated using(public.is_album_member(album_id));
create policy submission_read on public.submissions for select to authenticated using(public.is_member(request_id));
revoke all on public.albums,public.album_members,public.submissions from anon,authenticated;
grant select on public.albums,public.album_members,public.submissions to authenticated;
create function public.create_album(p_title text,p_nickname text) returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 insert into albums(title) values(trim(p_title)) returning id into aid;
 insert into album_members values(aid,auth.uid(),trim(p_nickname));return aid;
end $$;
-- Old clients can still create a request; it receives its own album.
create or replace function public.create_request(p_title text,p_nickname text) returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid;aid uuid;
begin
 aid:=public.create_album(p_title,p_nickname);
 insert into requests(owner_id,title,album_id) values(auth.uid(),trim(p_title),aid) returning id into rid;
 insert into members values(rid,auth.uid(),trim(p_nickname));return rid;
end $$;
create function public.create_album_request(p_album uuid,p_title text,p_nickname text) returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 perform 1 from albums where id=p_album for update;
 if not public.is_album_member(p_album) then raise exception 'Album membership required';end if;
 update album_members set nickname=trim(p_nickname) where album_id=p_album and user_id=auth.uid();
 insert into requests(owner_id,title,album_id) values(auth.uid(),trim(p_title),p_album) returning id into rid;
 insert into members select rid,user_id,nickname from album_members where album_id=p_album;return rid;
end $$;
-- A request invitation admits a participant to the entire album, including future requests.
create or replace function public.join_request(p_token uuid,p_nickname text) returns uuid language plpgsql security definer set search_path=public as $$
declare r requests;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into r from requests where invite_token=p_token;
 if not found then raise exception 'Invalid invite';end if;
 perform 1 from albums where id=r.album_id for update;
 if not public.is_album_member(r.album_id) and (select count(*) from album_members where album_id=r.album_id)>=3 then raise exception 'Album is full';end if;
 insert into album_members values(r.album_id,auth.uid(),trim(p_nickname)) on conflict(album_id,user_id) do update set nickname=excluded.nickname;
 insert into members select id,auth.uid(),trim(p_nickname) from requests where album_id=r.album_id on conflict(request_id,user_id) do update set nickname=excluded.nickname;return r.id;
end $$;
create function public.submit_selection(p_request uuid) returns void language plpgsql security definer set search_path=public as $$
declare r requests;ids uuid[];
begin
 select * into r from requests where id=p_request for update;
 if not public.is_member(p_request) or r.status<>'selecting' then raise exception 'Not allowed';end if;
 if not exists(select 1 from photos where request_id=p_request) or exists(select 1 from photos p where p.request_id=p_request and not exists(select 1 from reactions v where v.photo_id=p.id and v.user_id=auth.uid())) then raise exception 'Classify every photo before submitting';end if;
 select coalesce(array_agg(p.id order by p.created_at,p.id),'{}'::uuid[]) into ids from photos p join reactions v on v.photo_id=p.id and v.user_id=auth.uid() and v.value='like' where p.request_id=p_request;
 insert into submissions values(p_request,auth.uid(),ids,now()) on conflict(request_id,user_id) do update set selected_ids=excluded.selected_ids,created_at=excluded.created_at;
end $$;
-- Editing a vote or uploading a new photo invalidates the relevant submitted snapshot.
create function public.invalidate_submission() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='photos' then delete from submissions where request_id=new.request_id;
 else delete from submissions where request_id=(select request_id from photos where id=coalesce(new.photo_id,old.photo_id)) and user_id=coalesce(new.user_id,old.user_id);end if;
 return null;
end $$;
create trigger photo_invalidates_submission after insert on public.photos for each row execute function public.invalidate_submission();
create trigger reaction_invalidates_submission after insert or update or delete on public.reactions for each row execute function public.invalidate_submission();
revoke execute on function public.is_album_member(uuid),public.create_album(text,text),public.create_album_request(uuid,text,text),public.submit_selection(uuid),public.invalidate_submission() from public,anon;
grant execute on function public.is_album_member(uuid),public.create_album(text,text),public.create_album_request(uuid,text,text),public.submit_selection(uuid) to authenticated;
