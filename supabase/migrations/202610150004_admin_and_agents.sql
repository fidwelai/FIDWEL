-- FIDWEL admin tools and agent referrals
--
-- Apply after 202610150003_vendor_orders_and_subscriptions.sql. It adds:
--   1. An is_admin() helper and read-only admin visibility across the schema.
--   2. Vendor acquisition agent attribution (vendor_profiles.agent_id) with a
--      policy so agents can view the vendors they referred.
--
-- Admins are provisioned through the ADMIN_EMAILS environment allowlist: the
-- server promotes a matching account to profiles.role = 'admin' on first use.
-- Moderation writes (vendor status, product approval) still run through the
-- service-role route handlers because the moderation triggers block any
-- change made by a signed-in user.

-- 1. Admin visibility ---------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can view all vendors" on public.vendor_profiles;
create policy "Admins can view all vendors"
on public.vendor_profiles for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can view all products" on public.products;
create policy "Admins can view all products"
on public.products for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders"
on public.orders for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can view all order items" on public.order_items;
create policy "Admins can view all order items"
on public.order_items for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can view all subscriptions" on public.vendor_subscriptions;
create policy "Admins can view all subscriptions"
on public.vendor_subscriptions for select to authenticated
using (public.is_admin());

-- 2. Vendor acquisition agents ------------------------------------------------

alter table public.vendor_profiles
  add column if not exists agent_id uuid references auth.users (id) on delete set null;

create index if not exists vendor_profiles_agent_id_idx
  on public.vendor_profiles (agent_id);

-- Agents can see the vendors they referred so they can track onboarding.
drop policy if exists "Agents can view referred vendors" on public.vendor_profiles;
create policy "Agents can view referred vendors"
on public.vendor_profiles for select to authenticated
using (agent_id = auth.uid());
