-- FIDWEL vendor orders and subscriptions
--
-- Apply after 202610150002_orders.sql. It adds:
--   1. Per-item fulfillment tracking so each vendor manages only the items in
--      an order that belong to them (a single order can contain many vendors).
--   2. Vendor read access to the orders that contain their items.
--   3. A vendor_subscriptions table for free and paid monthly plans.
--
-- Vendor writes (fulfillment status, subscription changes) are intentionally
-- NOT granted to the client. They run through server route handlers that use
-- the service role, the same pattern as checkout and payments.

-- 1. Per-item fulfillment -----------------------------------------------------

alter table public.order_items
  add column if not exists fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled'));

create index if not exists order_items_fulfillment_status_idx
  on public.order_items (fulfillment_status);

-- 2. Vendor access helpers ----------------------------------------------------

-- Returns the vendor_profiles.id owned by the caller. Runs with definer rights
-- so policies can resolve the vendor without recursively querying RLS tables.
create or replace function public.current_vendor_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.vendor_profiles
  where user_id = auth.uid()
  limit 1;
$$;

-- True when the given order contains at least one item owned by the caller.
-- Definer rights keep the lookup from being filtered by order_items RLS and
-- avoid recursive policy evaluation on orders.
create or replace function public.vendor_has_order(target_order uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.order_items
    where order_id = target_order
      and vendor_id = public.current_vendor_profile_id()
  );
$$;

grant execute on function public.current_vendor_profile_id() to authenticated;
grant execute on function public.vendor_has_order(uuid) to authenticated;

drop policy if exists "Vendors can view items in their orders" on public.order_items;
create policy "Vendors can view items in their orders"
on public.order_items for select to authenticated
using (vendor_id = public.current_vendor_profile_id());

drop policy if exists "Vendors can view orders containing their items" on public.orders;
create policy "Vendors can view orders containing their items"
on public.orders for select to authenticated
using (public.vendor_has_order(id));

-- 3. Vendor subscriptions -----------------------------------------------------

create table if not exists public.vendor_subscriptions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null unique references public.vendor_profiles (id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active'
    check (status in ('active', 'past_due', 'cancelled', 'expired')),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  currency text not null default 'NGN',
  billing_interval text not null default 'monthly',
  current_period_start timestamptz,
  current_period_end timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_subscriptions_vendor_id_idx
  on public.vendor_subscriptions (vendor_id);

drop trigger if exists vendor_subscriptions_set_updated_at on public.vendor_subscriptions;
create trigger vendor_subscriptions_set_updated_at
before update on public.vendor_subscriptions
for each row execute function public.set_updated_at();

alter table public.vendor_subscriptions enable row level security;

drop policy if exists "Vendors can view their subscription" on public.vendor_subscriptions;
create policy "Vendors can view their subscription"
on public.vendor_subscriptions for select to authenticated
using (vendor_id = public.current_vendor_profile_id());

grant select on public.vendor_subscriptions to authenticated;
