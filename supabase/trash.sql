-- Run after access.sql. Private trash + audit. Existing public content is preserved.
begin;
create table if not exists public.site_trash (
  id bigint generated always as identity primary key,
  section text not null check (section in ('stays','destinations','products','highlights','socials','product_links')),
  item_id text not null,
  parent_id text,
  parent_label text,
  original_index integer not null,
  payload jsonb not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_by_email text,
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete set null
);
create table if not exists public.site_activity (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null check (action in ('access','create','edit','trash','restore','permissions')),
  section text not null default '',
  item_label text not null default '',
  created_at timestamptz not null default now()
);
alter table public.site_trash enable row level security;
alter table public.site_activity enable row level security;
revoke all on public.site_trash, public.site_activity from anon, authenticated;
grant select on public.site_trash, public.site_activity to authenticated;
grant all on public.site_trash, public.site_activity to service_role;
grant usage, select on sequence public.site_trash_id_seq, public.site_activity_id_seq to service_role;
drop policy if exists "Only native admins read trash" on public.site_trash;
create policy "Only native admins read trash" on public.site_trash for select to authenticated using (public.is_site_admin());
drop policy if exists "Only native admins read activity" on public.site_activity;
create policy "Only native admins read activity" on public.site_activity for select to authenticated using (public.is_site_admin());
create index if not exists site_trash_deleted_idx on public.site_trash(deleted_at desc);
create index if not exists site_activity_created_idx on public.site_activity(created_at desc);

create or replace function public.megabio_normalize_items(items jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare item jsonb; normalized jsonb := '[]'; identities text[] := '{}'; identity text;
begin
  if items is null then return '[]'; end if;
  if jsonb_typeof(items) <> 'array' then raise exception 'Expected a list' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) <> 'object' then raise exception 'Invalid item' using errcode = '22023'; end if;
    identity := item->>'_id';
    if identity is null or identity !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then identity := gen_random_uuid()::text; end if;
    if identity = any(identities) then raise exception 'Duplicate item identity' using errcode = '22023'; end if;
    identities := array_append(identities, identity);
    normalized := normalized || jsonb_build_array(jsonb_set(item,'{_id}',to_jsonb(identity),true));
  end loop;
  return normalized;
end;
$$;
revoke all on function public.megabio_normalize_items(jsonb) from public;

create or replace function public.megabio_normalize_content(payload jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare section_key text; product jsonb; products jsonb := '[]';
begin
  foreach section_key in array array['stays','destinations','products','highlights','socials'] loop
    if payload ? section_key then payload := jsonb_set(payload,array[section_key],public.megabio_normalize_items(payload->section_key),true); end if;
  end loop;
  for product in select value from jsonb_array_elements(coalesce(payload->'products','[]')) loop
    product := jsonb_set(product,'{links}',public.megabio_normalize_items(product->'links'),true);
    products := products || jsonb_build_array(product);
  end loop;
  if payload ? 'products' then payload := jsonb_set(payload,'{products}',products); end if;
  return payload;
end;
$$;
revoke all on function public.megabio_normalize_content(jsonb) from public;

-- Safe one-time identity backfill; repeated runs keep the same identities.
update public.site_content set payload = public.megabio_normalize_content(payload), updated_at = clock_timestamp()
where payload is distinct from public.megabio_normalize_content(payload);

create or replace function public.megabio_prepare_content()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.payload := public.megabio_normalize_content(new.payload);
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.megabio_prepare_content() from public;
drop trigger if exists megabio_prepare_content on public.site_content;
create trigger megabio_prepare_content before insert or update on public.site_content for each row execute function public.megabio_prepare_content();

create or replace function public.megabio_capture_items(old_items jsonb, new_items jsonb, section_name text, parent_identity text default null, parent_name text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_item jsonb; new_item jsonb; position integer := 0; actor uuid := auth.uid(); email text;
begin
  select u.email::text into email from auth.users u where u.id = actor;
  for old_item in select value from jsonb_array_elements(coalesce(old_items,'[]')) loop
    select value into new_item from jsonb_array_elements(coalesce(new_items,'[]')) where value->>'_id' = old_item->>'_id';
    if new_item is null then
      insert into public.site_trash(section,item_id,parent_id,parent_label,original_index,payload,deleted_by,deleted_by_email)
        values(section_name,old_item->>'_id',parent_identity,parent_name,position,old_item,actor,email);
      insert into public.site_activity(actor_id,actor_email,action,section,item_label)
        values(actor,email,'trash',section_name,coalesce(old_item->>'title',old_item->>'label','Item'));
    elsif (case when section_name='products' then new_item-'links' else new_item end)
      is distinct from (case when section_name='products' then old_item-'links' else old_item end) then
      insert into public.site_activity(actor_id,actor_email,action,section,item_label)
        values(actor,email,'edit',section_name,coalesce(new_item->>'title',new_item->>'label','Item'));
    end if;
    if section_name='products' and new_item is not null then
      perform public.megabio_capture_items(old_item->'links',new_item->'links','product_links',old_item->>'_id',old_item->>'title');
    end if;
    position := position + 1;
  end loop;
  for new_item in select value from jsonb_array_elements(coalesce(new_items,'[]')) loop
    if not exists(select 1 from jsonb_array_elements(coalesce(old_items,'[]')) where value->>'_id'=new_item->>'_id') then
      if coalesce(current_setting('megabio.restoring',true),'') <> new_item->>'_id' then
        insert into public.site_activity(actor_id,actor_email,action,section,item_label)
          values(actor,email,'create',section_name,coalesce(new_item->>'title',new_item->>'label','Item'));
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.megabio_capture_items(jsonb,jsonb,text,text,text) from public;

create or replace function public.megabio_audit_content()
returns trigger language plpgsql security definer set search_path = public as $$
declare section_key text; actor uuid := auth.uid(); email text;
begin
  select u.email::text into email from auth.users u where u.id=actor;
  foreach section_key in array array['stays','destinations','products','highlights','socials'] loop
    perform public.megabio_capture_items(old.payload->section_key,new.payload->section_key,section_key);
  end loop;
  foreach section_key in array array['profile','contact'] loop
    if old.payload->section_key is distinct from new.payload->section_key then
      insert into public.site_activity(actor_id,actor_email,action,section,item_label) values(actor,email,'edit',section_key,'Informações atualizadas');
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.megabio_audit_content() from public;
drop trigger if exists megabio_audit_content on public.site_content;
create trigger megabio_audit_content after update on public.site_content for each row execute function public.megabio_audit_content();

create or replace function public.trash_site_item(section_name text,item_identity text,expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare current_row public.site_content%rowtype; permission_name text; item_index integer;
begin
  permission_name := case section_name when 'stays' then 'stay' when 'destinations' then 'destinations' when 'products' then 'products' when 'highlights' then 'highlights' when 'socials' then 'socials' else null end;
  if permission_name is null or not public.has_site_permission(permission_name) then raise exception 'Access denied' using errcode='42501'; end if;
  select * into current_row from public.site_content where id=1 for update;
  if current_row.updated_at is distinct from expected_updated_at then raise exception 'Content changed. Reload before deleting.' using errcode='40001'; end if;
  select (ordinality-1)::integer into item_index from jsonb_array_elements(current_row.payload->section_name) with ordinality where value->>'_id'=item_identity;
  if item_index is null then raise exception 'Item not found' using errcode='22023'; end if;
  update public.site_content set payload=jsonb_set(payload,array[section_name],(payload->section_name)-item_index) where id=1 returning * into current_row;
  return jsonb_build_object('payload',current_row.payload,'updated_at',current_row.updated_at);
end;
$$;
revoke all on function public.trash_site_item(text,text,timestamptz) from public;
grant execute on function public.trash_site_item(text,text,timestamptz) to authenticated;

create or replace function public.restore_site_item(trash_identity bigint,expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare entry public.site_trash%rowtype; current_row public.site_content%rowtype; items jsonb; insert_index integer; parent_index integer;
begin
  if not public.is_site_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  select * into current_row from public.site_content where id=1 for update;
  if current_row.updated_at is distinct from expected_updated_at then raise exception 'Content changed. Reload before restoring.' using errcode='40001'; end if;
  select * into entry from public.site_trash where id=trash_identity for update;
  if not found or entry.restored_at is not null then raise exception 'Trash item unavailable' using errcode='22023'; end if;
  if entry.section='product_links' then
    select (ordinality-1)::integer into parent_index from jsonb_array_elements(current_row.payload->'products') with ordinality where value->>'_id'=entry.parent_id;
    if parent_index is null then raise exception 'Restore the parent product first' using errcode='22023'; end if;
    items := coalesce(current_row.payload#>array['products',parent_index::text,'links'],'[]');
  else items := coalesce(current_row.payload->entry.section,'[]'); end if;
  if exists(select 1 from jsonb_array_elements(items) where value->>'_id'=entry.item_id) then raise exception 'Item already active' using errcode='22023'; end if;
  insert_index := least(entry.original_index,jsonb_array_length(items));
  items := jsonb_insert(items,array[insert_index::text],entry.payload);
  perform set_config('megabio.restoring',entry.item_id,true);
  if entry.section='product_links' then current_row.payload := jsonb_set(current_row.payload,array['products',parent_index::text,'links'],items);
  else current_row.payload := jsonb_set(current_row.payload,array[entry.section],items,true); end if;
  update public.site_content set payload=current_row.payload where id=1 returning * into current_row;
  update public.site_trash set restored_at=clock_timestamp(),restored_by=auth.uid() where id=entry.id;
  insert into public.site_activity(actor_id,actor_email,action,section,item_label)
    select auth.uid(),u.email::text,'restore',entry.section,coalesce(entry.payload->>'title',entry.payload->>'label','Item') from auth.users u where u.id=auth.uid();
  return jsonb_build_object('payload',current_row.payload,'updated_at',current_row.updated_at);
end;
$$;
revoke all on function public.restore_site_item(bigint,timestamptz) from public;
grant execute on function public.restore_site_item(bigint,timestamptz) to authenticated;

create or replace function public.record_site_access()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_site_admin() and not exists(select 1 from public.site_members where user_id=auth.uid() and active and cardinality(permissions)>0) then raise exception 'Access denied' using errcode='42501'; end if;
  insert into public.site_activity(actor_id,actor_email,action,section,item_label)
    select u.id,u.email::text,'access','panel','Acesso ao painel' from auth.users u
    where u.id=auth.uid() and not exists(select 1 from public.site_activity a where a.actor_id=auth.uid() and a.action='access' and a.created_at>now()-interval '1 minute');
end;
$$;
revoke all on function public.record_site_access() from public;
grant execute on function public.record_site_access() to authenticated;

create or replace function public.megabio_audit_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.site_activity(actor_id,actor_email,action,section,item_label)
    values(auth.uid(),(select email::text from auth.users where id=auth.uid()),case when tg_op='INSERT' then 'create' else 'permissions' end,'users',new.name);
  return new;
end;
$$;
revoke all on function public.megabio_audit_members() from public;
drop trigger if exists megabio_audit_members on public.site_members;
create trigger megabio_audit_members after insert or update on public.site_members for each row execute function public.megabio_audit_members();
create or replace function public.content_management_status()
returns jsonb language sql stable security definer set search_path = public
as $$ select jsonb_build_object('version',1,'native',public.is_site_admin()) where auth.uid() is not null; $$;
revoke all on function public.content_management_status() from public;
grant execute on function public.content_management_status() to authenticated;
commit;
