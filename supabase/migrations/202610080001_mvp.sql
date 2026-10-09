-- Run once in a new Supabase project's SQL editor. Enable anonymous Auth separately.
create table public.requests (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 title text not null check (length(title) between 1 and 60),
 invite_token uuid not null unique default gen_random_uuid(),
 status text not null default 'selecting' check(status in ('selecting','confirmed')),
 selected_ids uuid[] not null default '{}', created_at timestamptz not null default now()
);
create table public.members (
 request_id uuid references public.requests(id) on delete cascade, user_id uuid references auth.users(id),
 nickname text not null check(length(nickname) between 1 and 20), primary key(request_id,user_id)
);
create table public.photos (
 id uuid primary key, request_id uuid not null references public.requests(id) on delete cascade,
 original_path text not null, thumbnail_path text not null, filename text not null,
 mime_type text not null, width integer not null, height integer not null, byte_size bigint not null,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
create table public.reactions (
 photo_id uuid references public.photos(id) on delete cascade, user_id uuid references auth.users(id),
 value text not null check(value in ('dislike','unsure','like')), primary key(photo_id,user_id)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests(id) on delete cascade,
 photo_id uuid references public.photos(id) on delete cascade, user_id uuid not null references auth.users(id),
 body text not null check(length(body) between 1 and 500), created_at timestamptz not null default now()
);
create function public.is_member(rid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from members where request_id=rid and user_id=auth.uid());
$$;
alter table public.requests enable row level security;
alter table public.members enable row level security;
alter table public.photos enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
create policy request_read on public.requests for select to authenticated using (public.is_member(id));
create policy member_read on public.members for select to authenticated using(public.is_member(request_id));
create policy photo_read on public.photos for select to authenticated using(public.is_member(request_id));
create policy reaction_read on public.reactions for select to authenticated using(exists(select 1 from public.photos p where p.id=photo_id and public.is_member(p.request_id)));
create policy comment_read on public.comments for select to authenticated using(public.is_member(request_id));
revoke insert,update,delete on public.requests,public.members,public.photos,public.reactions,public.comments from anon,authenticated;
grant select on public.requests,public.members,public.photos,public.reactions,public.comments to authenticated;

create function public.create_request(p_title text,p_nickname text) returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into requests(owner_id,title) values(auth.uid(),trim(p_title)) returning id into rid;
 insert into members values(rid,auth.uid(),trim(p_nickname)); return rid;
end $$;
create function public.preview_invite(p_token uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('title',r.title,'status',r.status,'owner',m.nickname)
 from requests r join members m on m.request_id=r.id and m.user_id=r.owner_id where r.invite_token=p_token;
$$;
create function public.join_request(p_token uuid,p_nickname text) returns uuid language plpgsql security definer set search_path=public as $$
declare r requests;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into r from requests where invite_token=p_token for update;
 if not found then raise exception 'Invalid invite'; end if;
 if exists(select 1 from members where request_id=r.id and user_id=auth.uid()) then return r.id; end if;
 if r.status<>'selecting' then raise exception 'Request already confirmed'; end if;
 if (select count(*) from members where request_id=r.id)>=3 then raise exception 'This request is full'; end if;
 insert into members values(r.id,auth.uid(),trim(p_nickname)); return r.id;
end $$;
create function public.register_photo(p_id uuid,p_request uuid,p_filename text,p_mime text,p_width integer,p_height integer,p_bytes bigint,p_sha256 text) returns void language plpgsql security definer set search_path=public as $$
declare r requests; op text; tp text;
begin
 select * into r from requests where id=p_request for update;
 if r.owner_id is distinct from auth.uid() or r.status<>'selecting' then raise exception 'Not allowed'; end if;
 op:=r.id::text||'/original/'||p_id::text||'/'||p_filename;
 tp:=r.id::text||'/thumbnail/'||p_id::text||'.jpg';
 if not exists(select 1 from storage.objects where bucket_id='request-photos' and name=op)
 or not exists(select 1 from storage.objects where bucket_id='request-photos' and name=tp) then raise exception 'Upload incomplete'; end if;
 insert into photos values(p_id,p_request,op,tp,p_filename,p_mime,p_width,p_height,p_bytes,p_sha256,now());
end $$;
create function public.set_reaction(p_photo uuid,p_value text) returns void language plpgsql security definer set search_path=public as $$
declare rid uuid; r requests;
begin
 select request_id into rid from photos where id=p_photo;
 select * into r from requests where id=rid for update;
 if not public.is_member(rid) or r.status<>'selecting' then raise exception 'Not allowed'; end if;
 if p_value is null then delete from reactions where photo_id=p_photo and user_id=auth.uid();
 else insert into reactions values(p_photo,auth.uid(),p_value) on conflict(photo_id,user_id) do update set value=excluded.value; end if;
end $$;
create function public.add_comment(p_request uuid,p_photo uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$
declare r requests;
begin
 select * into r from requests where id=p_request for update;
 if not public.is_member(p_request) or r.status<>'selecting' then raise exception 'Not allowed'; end if;
 if p_photo is not null and not exists(select 1 from photos where id=p_photo and request_id=p_request) then raise exception 'Wrong photo'; end if;
 insert into comments(request_id,photo_id,user_id,body) values(p_request,p_photo,auth.uid(),trim(p_body));
end $$;
create function public.confirm_request(p_request uuid,p_selected uuid[]) returns void language plpgsql security definer set search_path=public as $$
declare r requests; total integer;
begin
 select * into r from requests where id=p_request for update;
 if r.owner_id is distinct from auth.uid() or r.status<>'selecting' then raise exception 'Not allowed'; end if;
 select count(distinct x) into total from unnest(p_selected) x;
 if total=0 or total<>cardinality(p_selected) or total<>(select count(*) from photos where request_id=p_request and id=any(p_selected)) then raise exception 'Invalid selection'; end if;
 update requests set status='confirmed',selected_ids=p_selected where id=p_request;
end $$;
-- SECURITY DEFINER RPCs must never be implicitly executable by anonymous API callers.
revoke execute on function public.is_member(uuid),public.create_request(text,text),public.preview_invite(uuid),public.join_request(uuid,text),public.register_photo(uuid,uuid,text,text,integer,integer,bigint,text),public.set_reaction(uuid,text),public.add_comment(uuid,uuid,text),public.confirm_request(uuid,uuid[]) from public,anon;
grant execute on function public.is_member(uuid),public.create_request(text,text),public.preview_invite(uuid),public.join_request(uuid,text),public.register_photo(uuid,uuid,text,text,integer,integer,bigint,text),public.set_reaction(uuid,text),public.add_comment(uuid,uuid,text),public.confirm_request(uuid,uuid[]) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('request-photos','request-photos',false,26214400,array['image/jpeg','image/png','image/heic','image/heif','image/webp']);
create policy storage_read on storage.objects for select to authenticated using(
 bucket_id='request-photos' and exists(select 1 from public.requests r where r.id::text=(storage.foldername(name))[1]
 and public.is_member(r.id) and ((storage.foldername(name))[2]='thumbnail' or r.owner_id=auth.uid())));
create policy storage_upload on storage.objects for insert to authenticated with check(
 bucket_id='request-photos' and exists(select 1 from public.requests r where r.id::text=(storage.foldername(name))[1]
 and r.owner_id=auth.uid() and r.status='selecting') and (storage.foldername(name))[2] in ('original','thumbnail'));
-- Failed uploads can be cleaned up by the owner while selection is open.
create policy storage_cleanup on storage.objects for delete to authenticated using(
 bucket_id='request-photos' and exists(select 1 from public.requests r where r.id::text=(storage.foldername(name))[1]
 and r.owner_id=auth.uid() and r.status='selecting') and not exists(select 1 from public.photos p where p.original_path=name or p.thumbnail_path=name));
