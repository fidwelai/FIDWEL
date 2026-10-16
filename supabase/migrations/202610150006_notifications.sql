-- FIDWEL notifications
--
-- Apply after 202610150005_product_stock.sql. Adds an in-app notification inbox
-- for customers and vendors. Rows are written by the service role from order,
-- payment, vendor-moderation, and subscription events; the owning user reads
-- them and marks them read through Row Level Security.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

-- Users can read their own notifications.
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
on public.notifications for select to authenticated
using (user_id = auth.uid());

-- Users can mark their own notifications read. There is intentionally no INSERT
-- policy: notifications are only created by the service role, which bypasses RLS.
drop policy if exists "Users can mark their notifications read" on public.notifications;
create policy "Users can mark their notifications read"
on public.notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, update on public.notifications to authenticated;
