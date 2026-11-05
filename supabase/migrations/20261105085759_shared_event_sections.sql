-- Events reuse albums; collected photos are references, never duplicate Storage files.
create function public.create_event(p_nickname text) returns uuid
language plpgsql security invoker set search_path=public as $$
begin
 if length(trim(p_nickname)) not between 1 and 20 then raise exception 'Invalid nickname';end if;
 return public.create_request('함께한 순간',trim(p_nickname));
end $$;
revoke execute on function public.create_event(text) from public,anon;
grant execute on function public.create_event(text) to authenticated;

create policy event_rename on public.albums for update to authenticated
 using(public.is_album_member(id)) with check(public.is_album_member(id));
grant update(title) on public.albums to authenticated;

create table public.album_photo_sections(
 album_id uuid not null,
 user_id uuid not null,
 photo_id uuid not null references public.photos(id) on delete cascade,
 primary key(album_id,user_id,photo_id),
 foreign key(album_id,user_id) references public.album_members(album_id,user_id) on delete cascade
);
create index album_photo_sections_photo_idx on public.album_photo_sections(photo_id);
alter table public.album_photo_sections enable row level security;
revoke all on public.album_photo_sections from public,anon,authenticated;
grant select,insert,delete on public.album_photo_sections to authenticated;
create policy event_section_read on public.album_photo_sections for select to authenticated using(
 public.is_album_member(album_id) and exists(
  select 1 from public.photos p join public.requests r on r.id=p.request_id
  where p.id=album_photo_sections.photo_id and r.album_id=album_photo_sections.album_id and public.is_member(r.id)
 )
);
create policy event_section_add on public.album_photo_sections for insert to authenticated with check(
 user_id=(select auth.uid()) and public.is_album_member(album_id) and exists(
  select 1 from public.photos p join public.requests r on r.id=p.request_id
  where p.id=album_photo_sections.photo_id and r.album_id=album_photo_sections.album_id and r.owner_id<>(select auth.uid()) and public.is_member(r.id)
 )
);
create policy event_section_remove on public.album_photo_sections for delete to authenticated using(
 user_id=(select auth.uid()) and public.is_album_member(album_id)
);
