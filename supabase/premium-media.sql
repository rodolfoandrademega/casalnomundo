-- Run after access.sql. Originals remain private; this migration does NOT enable sales.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('premium-originals','premium-originals',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']),
 ('premium-previews','premium-previews',true,1048576,array['image/jpeg'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table if not exists public.premium_media(
 id uuid primary key,
 title text not null check(char_length(title) between 1 and 140),
 description text not null default '' check(char_length(description)<=2000),
 location text not null default '' check(char_length(location)<=160),
 media_type text not null check(media_type in ('photo','video')),
 price_cents integer not null default 0 check(price_cents between 0 and 100000000),
 license text not null default 'Licenciamento a definir' check(char_length(license)<=2000),
 resolution text not null default '' check(char_length(resolution)<=100),
 original_path text not null unique,
 preview_path text not null unique,
 active boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.premium_media enable row level security;
revoke all on public.premium_media from anon,authenticated;
grant select on public.premium_media to authenticated;
grant all on public.premium_media to service_role;
drop policy if exists "Natives read premium media" on public.premium_media;
create policy "Natives read premium media" on public.premium_media for select to authenticated using(public.is_site_admin());
drop policy if exists "Natives read private originals" on storage.objects;
create policy "Natives read private originals" on storage.objects for select to authenticated using(bucket_id='premium-originals' and public.is_site_admin());
-- No public/visitor SELECT policy, and no browser INSERT/UPDATE/DELETE on originals.
-- Uploads use server-issued path-specific signed tokens after native authorization.
create or replace function public.save_premium_media(product jsonb,expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item_id uuid; previous public.premium_media%rowtype; saved public.premium_media%rowtype; original text; preview text; kind text;
begin
 if not public.is_site_admin() then raise exception 'Access denied' using errcode='42501';end if;
 item_id := (product->>'id')::uuid;
 perform pg_advisory_xact_lock(hashtext(item_id::text));
 select * into previous from public.premium_media where id=item_id for update;
 if found then
  if previous.updated_at is distinct from expected_updated_at then raise exception 'Content changed. Reload before saving.' using errcode='40001';end if;
  original:=previous.original_path;preview:=previous.preview_path;kind:=previous.media_type;
 else
  if expected_updated_at is not null then raise exception 'Item unavailable' using errcode='22023';end if;
  original:=product->>'original_path';preview:=product->>'preview_path';kind:=product->>'media_type';
  if original !~ ('^originals/'||item_id::text||'\.(jpg|png|webp|mp4|webm)$') or preview is distinct from 'previews/'||item_id::text||'.jpg' then raise exception 'Invalid asset paths' using errcode='22023';end if;
  if not exists(select 1 from storage.objects where bucket_id='premium-originals' and name=original) or not exists(select 1 from storage.objects where bucket_id='premium-previews' and name=preview) then raise exception 'Upload both files before saving' using errcode='22023';end if;
 end if;
 insert into public.premium_media(id,title,description,location,media_type,price_cents,license,resolution,original_path,preview_path,active)
 values(item_id,trim(product->>'title'),coalesce(product->>'description',''),coalesce(product->>'location',''),kind,coalesce((product->>'price_cents')::integer,0),coalesce(nullif(product->>'license',''),'Licenciamento a definir'),coalesce(product->>'resolution',''),original,preview,coalesce((product->>'active')::boolean,false))
 on conflict(id) do update set title=excluded.title,description=excluded.description,location=excluded.location,price_cents=excluded.price_cents,license=excluded.license,resolution=excluded.resolution,active=excluded.active,updated_at=clock_timestamp()
 returning * into saved;
 if to_regclass('public.site_activity') is not null then
  insert into public.site_activity(actor_id,actor_email,action,section,item_label) values(auth.uid(),(select email::text from auth.users where id=auth.uid()),case when previous.id is null then 'create' else 'edit' end,'premium_media',saved.title);
 end if;
 return to_jsonb(saved);
end;$$;
revoke all on function public.save_premium_media(jsonb,timestamptz) from public;
grant execute on function public.save_premium_media(jsonb,timestamptz) to authenticated;
create or replace function public.list_premium_media()
returns table(id uuid,title text,description text,location text,media_type text,price_cents integer,license text,resolution text,preview_path text)
language sql stable security definer set search_path=public as $$
 select m.id,m.title,m.description,m.location,m.media_type,m.price_cents,m.license,m.resolution,m.preview_path
 from public.premium_media m where m.active and exists(select 1 from public.site_content s where s.id=1 and s.payload#>'{website,enabled}'='true'::jsonb and s.payload#>'{website,galleryEnabled}'='true'::jsonb) order by m.created_at desc;
$$;
revoke all on function public.list_premium_media() from public;
grant execute on function public.list_premium_media() to anon,authenticated;
commit;
