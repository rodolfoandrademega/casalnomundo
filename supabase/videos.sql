-- Optional setup for a new installation. Existing image uploads are unchanged.
-- The server-only /api/video-upload checks the caller's profile permission and
-- signs a path for one video; no public or authenticated INSERT policy is added.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-videos', 'site-videos', true, 26214400, array['video/mp4','video/webm'])
on conflict (id) do nothing;
