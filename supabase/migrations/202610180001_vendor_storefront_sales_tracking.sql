-- Give each vendor a stable public storefront and sales tracking identifier.
alter table public.vendor_profiles
  add column if not exists sales_tracking_id uuid;

update public.vendor_profiles
set sales_tracking_id = gen_random_uuid()
where sales_tracking_id is null;

alter table public.vendor_profiles
  alter column sales_tracking_id set default gen_random_uuid(),
  alter column sales_tracking_id set not null;

create unique index if not exists vendor_profiles_sales_tracking_id_uidx
  on public.vendor_profiles (sales_tracking_id);

alter table public.orders
  add column if not exists sales_tracking_id uuid
  references public.vendor_profiles (sales_tracking_id)
  on delete set null;

create index if not exists orders_sales_tracking_id_paid_idx
  on public.orders (sales_tracking_id, payment_status)
  where sales_tracking_id is not null;

create or replace function public.get_vendor_sales_tracking_summary(target_vendor_id uuid)
returns table (attributed_orders bigint, attributed_sales numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    count(distinct o.id),
    coalesce(sum(oi.line_total), 0)
  from public.vendor_profiles vp
  left join public.orders o
    on o.sales_tracking_id = vp.sales_tracking_id
    and o.payment_status = 'paid'
  left join public.order_items oi
    on oi.order_id = o.id
    and oi.vendor_id = vp.id
  where vp.id = target_vendor_id
  group by vp.id;
$$;

revoke all on function public.get_vendor_sales_tracking_summary(uuid)
  from public, anon, authenticated;
grant execute on function public.get_vendor_sales_tracking_summary(uuid)
  to service_role;

create or replace function public.protect_order_financials()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and (
    new.status is distinct from old.status
    or new.payment_status is distinct from old.payment_status
    or new.payment_reference is distinct from old.payment_reference
    or new.payment_provider is distinct from old.payment_provider
    or new.total is distinct from old.total
    or new.subtotal is distinct from old.subtotal
    or new.delivery_fee is distinct from old.delivery_fee
    or new.customer_id is distinct from old.customer_id
    or new.sales_tracking_id is distinct from old.sales_tracking_id
  ) then
    raise exception 'Order status, totals, payment, and sales attribution are managed by FIDWEL';
  end if;
  return new;
end;
$$;

drop policy if exists "Customers can create their own orders" on public.orders;
create policy "Customers can create their own orders"
on public.orders for insert to authenticated
with check (
  customer_id = auth.uid()
  and status = 'pending'
  and payment_status = 'unpaid'
  and sales_tracking_id is null
);
