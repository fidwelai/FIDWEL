-- Apply after 202610150009_product_images.sql. Makes the profile-picture upload
-- on the registration page work.
--
-- app/register/page.tsx uploads the avatar *before* signUp completes, because
-- email confirmation may be enabled (so there is no session, and therefore no
-- authenticated user, at upload time). The bucket is world-readable; this
-- migration grants a deliberately narrow anonymous INSERT: only into the
-- 'public/' prefix, only for whitelisted image types, and only up to the bucket
-- size limit (2 MB). Reads need no policy because the bucket is public.
--
-- Trade-off: this allows unauthenticated uploads of small images. It is scoped
-- as tightly as the pre-auth flow allows. The policy is INSERT-only (no anon
-- UPDATE), so `app/register/page.tsx` uploads with `upsert: false` — the object
-- path already includes a timestamp and random suffix, so it is always new.
-- If registration is later changed to upload after the user has a session, drop
-- this policy and require auth.uid() instead.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anonymous avatar uploads" on storage.objects;
create policy "Anonymous avatar uploads"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'avatars'
  and name like 'public/%'
);
