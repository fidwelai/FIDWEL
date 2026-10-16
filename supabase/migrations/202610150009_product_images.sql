-- Apply after 202610150008_reviews.sql. Adds the public Storage bucket used for
-- vendor product images.
--
-- Uploads are performed by the server (service role) from
-- POST /api/uploads/product-image, which authenticates the caller and verifies
-- they are an approved, active vendor. Because the write path never runs as anon
-- or authenticated, no storage.objects policies are granted here: the bucket is
-- world-readable (public) but locked down for writes, so only the service role
-- can add or replace objects. Direct client uploads are therefore not possible.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
