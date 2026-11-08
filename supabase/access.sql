-- Run after schema.sql and storage.sql. Existing site_admins are native admins.
begin;
create table if not exists public.site_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  permissions text[] not null default '{}'
    check (permissions <@ array['profile','stay','destinations','products','highlights','socials','reports']::text[]),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.site_members enable row level security;
revoke all on public.site_members from anon, authenticated;
grant select on public.site_members to authenticated;
grant all on public.site_members to service_role;
drop policy if exists "Members can view their access" on public.site_members;
create policy "Members can view their access" on public.site_members
  for select to authenticated using (user_id = auth.uid() or public.is_site_admin());

create or replace function public.has_site_permission(permission_name text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_site_admin() or exists (
    select 1 from public.site_members
    where user_id = auth.uid() and active and permission_name = any(permissions)
  );
$$;
revoke all on function public.has_site_permission(text) from public;
grant execute on function public.has_site_permission(text) to authenticated;

create or replace function public.save_site_sections(patch jsonb, expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  current_row public.site_content%rowtype;
  section_key text;
  permission_name text;
  native boolean := public.is_site_admin();
begin
  if auth.uid() is null then raise exception 'Access denied' using errcode = '42501'; end if;
  if jsonb_typeof(patch) is distinct from 'object' or patch = '{}'::jsonb then
    raise exception 'Invalid content patch' using errcode = '22023';
  end if;
  for section_key in select jsonb_object_keys(patch) loop
    permission_name := case section_key
      when 'profile' then 'profile' when 'stays' then 'stay'
      when 'destinations' then 'destinations' when 'products' then 'products'
      when 'highlights' then 'highlights' when 'socials' then 'socials'
      when 'contact' then 'socials' else null end;
    if not native and (permission_name is null or not public.has_site_permission(permission_name)) then
      raise exception 'Section access denied' using errcode = '42501';
    end if;
  end loop;
  select * into current_row from public.site_content where id = 1 for update;
  if not found then
    if not native then raise exception 'Content is not initialized' using errcode = '42501'; end if;
    insert into public.site_content(id, payload) values (1, patch) returning * into current_row;
  else
    if expected_updated_at is distinct from current_row.updated_at then
      raise exception 'Content changed. Reload before saving.' using errcode = '40001';
    end if;
    update public.site_content set payload = current_row.payload || patch, updated_at = clock_timestamp()
      where id = 1 returning * into current_row;
  end if;
  return jsonb_build_object('payload', current_row.payload, 'updated_at', current_row.updated_at);
end;
$$;
revoke all on function public.save_site_sections(jsonb,timestamptz) from public;
grant execute on function public.save_site_sections(jsonb,timestamptz) to authenticated;
-- Members cannot write site_content directly: existing admin-only RLS remains.

create or replace function public.list_site_members()
returns table(user_id uuid, name text, email text, permissions text[], active boolean, native boolean)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_site_admin() then raise exception 'Access denied' using errcode = '42501'; end if;
  return query
    select u.id, coalesce(m.name, nullif(u.raw_user_meta_data->>'name', ''), 'Usuário'),
      u.email::text, coalesce(m.permissions, '{}'::text[]), (coalesce(m.active, false) or exists(select 1 from public.site_admins a where a.user_id = u.id)),
      exists(select 1 from public.site_admins a where a.user_id = u.id)
    from auth.users u left join public.site_members m on m.user_id = u.id
    order by u.created_at;
end;
$$;
revoke all on function public.list_site_members() from public;
grant execute on function public.list_site_members() to authenticated;

create or replace function public.update_site_member(member_id uuid, member_permissions text[], member_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_site_admin() then raise exception 'Access denied' using errcode = '42501'; end if;
  if exists(select 1 from public.site_admins where user_id = member_id) then
    raise exception 'Native access cannot be changed here' using errcode = '42501';
  end if;
  if member_permissions is null or member_active is null then
    raise exception 'Invalid permissions' using errcode = '22023';
  end if;
  if member_active and cardinality(member_permissions) = 0 then
    raise exception 'Select at least one permission' using errcode = '22023';
  end if;
  insert into public.site_members(user_id, name, permissions, active)
    select u.id, left(coalesce(nullif(u.raw_user_meta_data->>'name', ''), 'Usuário'), 100), member_permissions, member_active
    from auth.users u where u.id = member_id
    on conflict (user_id) do update set permissions = excluded.permissions, active = excluded.active;
  if not found then raise exception 'Member not found' using errcode = '22023'; end if;
end;
$$;
revoke all on function public.update_site_member(uuid,text[],boolean) from public;
grant execute on function public.update_site_member(uuid,text[],boolean) to authenticated;

drop policy if exists "Permitted members can read analytics" on public.site_events;
create policy "Permitted members can read analytics" on public.site_events
  for select to authenticated using (public.has_site_permission('reports'));

drop policy if exists "Site admins can upload images" on storage.objects;
drop policy if exists "Permitted members can upload images" on storage.objects;
create policy "Permitted members can upload images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'site-images' and (storage.foldername(name))[1] = 'images'
    and (public.is_site_admin() or (
      (storage.foldername(name))[2] = any(array['profile','stay','destinations','products','highlights'])
      and public.has_site_permission((storage.foldername(name))[2])
    ))
  );
commit;
