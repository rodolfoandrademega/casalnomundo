-- Existing installations: allow natives to grant the Create users permission.
-- This does not grant it to any existing user automatically.
begin;
alter table public.site_members drop constraint if exists site_members_permissions_check;
alter table public.site_members add constraint site_members_permissions_check
  check (permissions <@ array['profile','stay','destinations','products','highlights','socials','reports','users']::text[]);
commit;
