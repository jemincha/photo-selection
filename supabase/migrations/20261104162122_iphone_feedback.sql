-- Preserve request-row locking, safety approval and existing access checks.
create or replace function public.publish_request(p_request uuid,p_title text) returns void language plpgsql security definer set search_path=public,private as $$
declare r requests;ids uuid[];
begin
 select * into r from requests where id=p_request for update;
 if not found or r.owner_id is distinct from auth.uid() or not public.is_member(r.id) or r.status<>'selecting' then raise exception 'Not allowed';end if;
 if length(trim(p_title)) not between 1 and 60 then raise exception 'Invalid title';end if;
 select array_agg(id order by id) into ids from photos where request_id=r.id;
 if ids is null or cardinality(ids)>100 then raise exception 'Prepare 1 to 100 photos';end if;
 if r.moderation_state<>'approved' or r.moderation_title is distinct from trim(p_title) or r.moderation_photos is distinct from ids then raise exception 'Safety check required';end if;
 update requests set title=trim(p_title),published_at=coalesce(published_at,now()) where id=r.id;
end $$;

create or replace function public.guard_simple_photo_insert() returns trigger language plpgsql security definer set search_path=public,private as $$
declare r requests;
begin
 select * into r from requests where id=new.request_id for update;
 if not public.is_member(r.id) or r.owner_id is distinct from auth.uid() or r.status<>'selecting' or (r.simple and r.published_at is not null) then raise exception 'Photos cannot change';end if;
 if (select count(*) from photos where request_id=r.id)>=100 then raise exception 'Maximum 100 photos';end if;
 if new.byte_size not between 1 and 26214400 or new.width<=0 or new.height<=0 or new.mime_type not in ('image/jpeg','image/png','image/heic','image/heif','image/webp') then raise exception 'Invalid photo';end if;
 update requests set moderation_state='pending',moderation_photos=null,moderation_title=null where id=r.id;
 return new;
end $$;
