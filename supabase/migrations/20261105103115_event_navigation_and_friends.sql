alter table public.albums add column owner_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.albums add column closed_at timestamptz;
alter table public.albums add column completed_at timestamptz;
update public.albums a set owner_id=(select r.owner_id from public.requests r where r.album_id=a.id order by r.created_at,r.id limit 1);

create function private.event_open(aid uuid) returns boolean language sql stable security definer set search_path=public,private as $$
 select exists(select 1 from albums where id=aid and closed_at is null and completed_at is null);
$$;
create function public.event_is_open(aid uuid) returns boolean language sql stable security definer set search_path=public,private as $$
 select public.is_album_member(aid) and private.event_open(aid);
$$;
create function private.sync_event_completion() returns trigger language plpgsql security definer set search_path=public,private as $$
declare aid uuid;
begin
 aid:=case when tg_op='DELETE' then old.album_id else new.album_id end;
 update albums a set completed_at=case when exists(select 1 from requests r where r.album_id=aid and r.deleted_at is null)
  and not exists(select 1 from requests r where r.album_id=aid and r.deleted_at is null and r.status<>'confirmed')
  then coalesce(a.completed_at,now()) else null end where a.id=aid;
 if exists(select 1 from albums where id=aid and completed_at is not null) then update event_invitations set status='declined' where album_id=aid and status='pending';end if;
 return null;
end $$;
create trigger event_completion after insert or update or delete on public.requests for each row execute function private.sync_event_completion();
update albums a set completed_at=now() where exists(select 1 from requests r where r.album_id=a.id and r.deleted_at is null)
 and not exists(select 1 from requests r where r.album_id=a.id and r.deleted_at is null and r.status<>'confirmed');
create function private.guard_event_request() returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if current_setting('role',true) in ('authenticated','anon') then
  perform 1 from albums where id=new.album_id for update;
  -- Deletion must remain available after an event has closed.
  if (tg_op='INSERT' or (new.deleted_at is null and old.deleted_at is null)) and not private.event_open(new.album_id) then raise exception 'Event closed';end if;
 end if;
 return new;
end $$;
create trigger event_request_guard before insert or update on public.requests for each row execute function private.guard_event_request();
create function public.close_event(p_album uuid) returns void language plpgsql security definer set search_path=public,private as $$
declare a albums;
begin
 select * into a from albums where id=p_album for update;
 if a.owner_id is distinct from auth.uid() or not public.is_album_member(p_album) then raise exception 'Not allowed';end if;
 update albums set closed_at=coalesce(closed_at,now()) where id=p_album;
 update event_invitations set status='declined' where album_id=p_album and status='pending';
end $$;
drop policy event_rename on public.albums;
create policy event_rename on public.albums for update to authenticated using(public.event_is_open(id)) with check(public.event_is_open(id) and length(trim(title)) between 1 and 60);

create or replace function public.set_reaction(p_photo uuid,p_value text) returns void language plpgsql security definer set search_path=public,private as $$
declare r requests;
begin
 select req.* into r from requests req join photos p on p.request_id=req.id where p.id=p_photo for update of req;
 if not found or not public.is_member(r.id) or r.status<>'selecting' or not private.event_open(r.album_id) then raise exception 'Not allowed';end if;
 if r.owner_id=auth.uid() then raise exception 'Self voting is not allowed';end if;
 if p_value is null then delete from reactions where photo_id=p_photo and user_id=auth.uid();
 else insert into reactions values(p_photo,auth.uid(),p_value) on conflict(photo_id,user_id) do update set value=excluded.value;end if;
end $$;
create function private.guard_friend_vote() returns trigger language plpgsql security definer set search_path=public,private as $$
declare r requests;rid uuid;
begin
 if current_setting('role',true) in ('authenticated','anon') then
  if tg_table_name='reactions' then select request_id into rid from photos where id=new.photo_id;else rid:=new.request_id;end if;
  select * into r from requests where id=rid;
  if new.user_id is distinct from auth.uid() or r.owner_id=auth.uid() or not public.is_member(r.id) or not private.event_open(r.album_id) then raise exception 'Self voting or closed event';end if;
 end if;
 return new;
end $$;
create trigger friend_vote_guard before insert or update on public.reactions for each row execute function private.guard_friend_vote();
create trigger friend_submission_guard before insert or update on public.submissions for each row execute function private.guard_friend_vote();
drop policy storage_upload on storage.objects;
create policy storage_upload on storage.objects for insert to authenticated with check(bucket_id='request-photos'
 and exists(select 1 from public.requests r where r.id::text=(storage.foldername(name))[1] and public.is_member(r.id)
 and public.event_is_open(r.album_id) and r.owner_id=auth.uid() and r.status='selecting' and (not r.simple or r.published_at is null))
 and (storage.foldername(name))[2] in ('original','thumbnail'));

create table public.friend_profiles(
 user_id uuid not null references auth.users(id) on delete cascade,
 friend_id uuid not null references auth.users(id) on delete cascade,
 nickname text not null check(length(nickname) between 1 and 20),
 primary key(user_id,friend_id),check(user_id<>friend_id)
);
create index friend_profiles_friend_idx on public.friend_profiles(friend_id);
alter table public.friend_profiles enable row level security;
revoke all on public.friend_profiles from public,anon,authenticated;
grant select on public.friend_profiles to authenticated;
create function public.contact_available(fid uuid) returns boolean language sql stable security definer set search_path=public,private as $$
 select private.active_user(auth.uid()) and private.active_user(fid) and not private.blocked(auth.uid(),fid)
 and exists(select 1 from friend_profiles where user_id=auth.uid() and friend_id=fid);
$$;
create policy friends_read on public.friend_profiles for select to authenticated using(user_id=(select auth.uid()) and public.contact_available(friend_id));
create function private.remember_event_friends() returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 insert into friend_profiles(user_id,friend_id,nickname)
 select a.user_id,b.user_id,b.nickname from album_members a join album_members b on a.album_id=b.album_id and a.user_id<>b.user_id
 where a.album_id=new.album_id on conflict(user_id,friend_id) do update set nickname=excluded.nickname;
 return null;
end $$;
create trigger remember_event_friends after insert or update on public.album_members for each row execute function private.remember_event_friends();
insert into friend_profiles(user_id,friend_id,nickname)
 select distinct on(a.user_id,b.user_id) a.user_id,b.user_id,b.nickname from album_members a join album_members b on a.album_id=b.album_id and a.user_id<>b.user_id
 order by a.user_id,b.user_id,a.album_id on conflict do nothing;

create table public.event_invitations(
 id uuid primary key default gen_random_uuid(),album_id uuid not null references public.albums(id) on delete cascade,
 inviter_id uuid not null references auth.users(id) on delete cascade,invitee_id uuid not null references auth.users(id) on delete cascade,
 title text not null,inviter_name text not null,status text not null default 'pending' check(status in ('pending','accepted','declined')),
 check(inviter_id<>invitee_id)
);
create unique index event_invitation_pending_idx on public.event_invitations(album_id,invitee_id) where status='pending';
create index event_invitation_inbox_idx on public.event_invitations(invitee_id,status);
create index event_invitation_inviter_idx on public.event_invitations(inviter_id);
alter table public.event_invitations enable row level security;
revoke all on public.event_invitations from public,anon,authenticated;
grant select on public.event_invitations to authenticated;
create policy invitations_read on public.event_invitations for select to authenticated using(invitee_id=(select auth.uid()) and public.contact_available(inviter_id));

create function public.invite_event_friend(p_album uuid,p_friend uuid) returns void language plpgsql security definer set search_path=public,private as $$
declare a albums;person text;
begin
 select * into a from albums where id=p_album for update;
 if not public.event_is_open(p_album) or not public.contact_available(p_friend) then raise exception 'Not allowed';end if;
 if exists(select 1 from album_members where album_id=p_album and user_id=p_friend) then raise exception 'Already a member';end if;
 if exists(select 1 from album_members peer where peer.album_id=p_album and private.blocked(p_friend,peer.user_id)) then raise exception 'Not allowed';end if;
 if (select count(*) from album_members where album_id=p_album)>=3 then raise exception 'Album is full';end if;
 if not exists(select 1 from requests where album_id=p_album and deleted_at is null and moderation_state='approved' and status='selecting' and invite_enabled) then raise exception 'Share approved photos first';end if;
 select nickname into person from album_members where album_id=p_album and user_id=auth.uid();
 insert into event_invitations(album_id,inviter_id,invitee_id,title,inviter_name) values(p_album,auth.uid(),p_friend,a.title,person) on conflict(album_id,invitee_id) where status='pending' do nothing;
end $$;
create function public.respond_event_invite(p_invite uuid,p_accept boolean,p_nickname text) returns uuid language plpgsql security definer set search_path=public,private as $$
declare invitation event_invitations;token uuid;
begin
 select * into invitation from event_invitations where id=p_invite;
 if not found or invitation.invitee_id is distinct from auth.uid() then raise exception 'Invalid invitation';end if;
 -- Match invitation creation/closure: lock the event before the invitation row.
 perform 1 from albums where id=invitation.album_id for update;
 select * into invitation from event_invitations where id=p_invite for update;
 if not found or invitation.invitee_id is distinct from auth.uid() or invitation.status<>'pending' or not public.contact_available(invitation.inviter_id) then raise exception 'Invalid invitation';end if;
 if not p_accept then update event_invitations set status='declined' where id=p_invite;return invitation.album_id;end if;
 if not private.event_open(invitation.album_id) or not exists(select 1 from album_members where album_id=invitation.album_id and user_id=invitation.inviter_id) then raise exception 'Event closed';end if;
 select invite_token into token from requests where album_id=invitation.album_id and deleted_at is null and moderation_state='approved' and status='selecting' and invite_enabled order by created_at,id limit 1;
 if token is null then raise exception 'Invite unavailable';end if;
 perform public.join_request(token,p_nickname);
 update event_invitations set status='accepted' where id=p_invite;return invitation.album_id;
end $$;
-- Link invitations must also stop at event closure.
create function private.guard_event_admission() returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if current_setting('role',true) in ('authenticated','anon') and not exists(select 1 from album_members where album_id=new.album_id and user_id=new.user_id) and not private.event_open(new.album_id) then raise exception 'Event closed';end if;
 return new;
end $$;
create trigger event_admission_guard before insert on public.album_members for each row execute function private.guard_event_admission();
revoke all on all functions in schema private from public,anon,authenticated;
revoke execute on function public.event_is_open(uuid),public.close_event(uuid),public.contact_available(uuid),public.invite_event_friend(uuid,uuid),public.respond_event_invite(uuid,boolean,text) from public,anon;
grant execute on function public.event_is_open(uuid),public.close_event(uuid),public.contact_available(uuid),public.invite_event_friend(uuid,uuid),public.respond_event_invite(uuid,boolean,text) to authenticated;
