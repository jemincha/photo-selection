create table private.support_feedback(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('bug','suggestion')),body text not null check(length(trim(body)) between 5 and 2000),
 status text not null default 'open' check(status in ('open','reviewing','resolved')),created_at timestamptz not null default now()
);
create index support_feedback_user_time on private.support_feedback(user_id,created_at);
create function public.submit_feedback(p_kind text,p_body text) returns uuid language plpgsql security definer set search_path=public,private as $$
declare ticket uuid;
begin
 if not private.active_user(auth.uid()) or p_kind not in ('bug','suggestion') or p_body is null or length(trim(p_body)) not between 5 and 2000 then raise exception 'Invalid feedback';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from private.support_feedback where user_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Feedback rate limited';end if;
 insert into private.support_feedback(user_id,kind,body) values(auth.uid(),p_kind,trim(p_body)) returning id into ticket;
 return ticket;
end $$;

-- Reuse durable request cleanup jobs; this path never deletes the Auth user.
create function public.clear_event_history() returns void language plpgsql security definer set search_path=public,private as $$
declare uid uuid:=auth.uid();rid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not private.active_user(uid) then raise exception 'Not allowed';end if;
 for rid in select id from requests where owner_id=uid and deleted_at is null order by id loop
  perform public.begin_request_deletion(rid);
 end loop;
 delete from reactions where user_id=uid;
 delete from comments where user_id=uid;
 delete from submissions where user_id=uid;
 delete from event_invitations where inviter_id=uid or invitee_id=uid;
 delete from members where user_id=uid;
 delete from album_members where user_id=uid;
 update albums a set owner_id=(select m.user_id from album_members m where m.album_id=a.id order by m.user_id limit 1) where a.owner_id=uid;
end $$;
revoke all on private.support_feedback from public,anon,authenticated;
revoke execute on function public.submit_feedback(text,text),public.clear_event_history() from public,anon;
grant execute on function public.submit_feedback(text,text),public.clear_event_history() to authenticated;
