-- Run this in Supabase SQL Editor before deploying.
create table if not exists public.site_content (
  id smallint primary key check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('visit','click','section','location')),
  link_id text not null default '',
  label text not null default '' check (char_length(label) <= 120),
  lat numeric(4,1),
  lon numeric(4,1),
  created_at timestamptz not null default now(),
  check (
    (kind = 'location' and lat between -90 and 90 and lon between -180 and 180)
    or (kind <> 'location' and lat is null and lon is null)
  )
);

create index if not exists site_events_kind_created_idx on public.site_events(kind, created_at desc);
create index if not exists site_events_location_idx on public.site_events(lat, lon) where kind = 'location';

alter table public.site_content enable row level security;
alter table public.site_admins enable row level security;
alter table public.site_events enable row level security;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.site_admins where user_id = auth.uid());
$$;

revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content" on public.site_content
  for select to anon, authenticated using (true);
drop policy if exists "Admins can insert site content" on public.site_content;
create policy "Admins can insert site content" on public.site_content
  for insert to authenticated with check (public.is_site_admin());
drop policy if exists "Admins can update site content" on public.site_content;
create policy "Admins can update site content" on public.site_content
  for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

drop policy if exists "Admins can view own admin row" on public.site_admins;
create policy "Admins can view own admin row" on public.site_admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Visitors can add anonymous events" on public.site_events;
create policy "Visitors can add anonymous events" on public.site_events
  for insert to anon, authenticated with check (
    kind in ('visit','click','section','location')
    and char_length(link_id) <= 80
    and char_length(label) <= 120
    and (
      (kind = 'location' and lat between -90 and 90 and lon between -180 and 180)
      or (kind <> 'location' and lat is null and lon is null)
    )
  );
drop policy if exists "Admins can read analytics" on public.site_events;
create policy "Admins can read analytics" on public.site_events
  for select to authenticated using (public.is_site_admin());

grant select on public.site_content to anon, authenticated;
grant insert, update on public.site_content to authenticated;
grant select on public.site_admins to authenticated;
grant insert on public.site_events to anon, authenticated;
grant select on public.site_events to authenticated;
grant usage, select on sequence public.site_events_id_seq to anon, authenticated;
