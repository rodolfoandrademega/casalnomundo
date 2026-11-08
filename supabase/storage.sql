-- Run once in Supabase SQL Editor after schema.sql.
-- Site images are public; only site administrators may upload them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-images', 'site-images', true, 5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Site admins can upload images" on storage.objects;
create policy "Site admins can upload images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-images'
    and (storage.foldername(name))[1] = 'images'
    and public.is_site_admin()
  );
-- No UPDATE/DELETE policies: replacements use new names and do not break
-- images that are already referenced by published content.
