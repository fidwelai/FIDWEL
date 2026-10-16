-- FIDWEL product stock
--
-- Apply after 202610150004_admin_and_agents.sql. Checkout must reserve stock
-- atomically so two shoppers cannot buy the same last unit, and cancelling an
-- order must return anything it reserved. Both actions run with the service
-- role, so the helpers are SECURITY DEFINER and are called through RPC.

-- 1. Atomic reserve / release -------------------------------------------------

-- Reserves `amount` units. The conditional UPDATE is the race guard: it only
-- succeeds when the listing is public and enough stock remains, so concurrent
-- checkouts cannot oversell. Returns false when the reservation is refused.
create or replace function public.decrement_product_stock(
  target_product_id bigint,
  amount numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id bigint;
begin
  if amount is null or amount <= 0 then
    return false;
  end if;

  update public.products
     set quantity_available = quantity_available - amount
   where id = target_product_id
     and is_available = true
     and approval_status = 'approved'
     and quantity_available >= amount
  returning id into updated_id;

  return updated_id is not null;
end;
$$;

-- Releases stock that was reserved but not committed (checkout rolled back).
create or replace function public.increment_product_stock(
  target_product_id bigint,
  amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if amount is null or amount <= 0 then
    return;
  end if;

  update public.products
     set quantity_available = quantity_available + amount
   where id = target_product_id;
end;
$$;

-- 2. Return stock when an order is cancelled ----------------------------------

-- Fires only on the transition into 'cancelled' so the same order can never be
-- restocked twice.
create or replace function public.restock_cancelled_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products product
     set quantity_available = product.quantity_available + item.quantity
    from public.order_items item
   where item.order_id = new.id
     and item.product_id = product.id;

  return new;
end;
$$;

drop trigger if exists orders_restock_on_cancel on public.orders;
create trigger orders_restock_on_cancel
after update on public.orders
for each row
when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
execute function public.restock_cancelled_order();

grant execute on function public.decrement_product_stock(bigint, numeric) to service_role;
grant execute on function public.increment_product_stock(bigint, numeric) to service_role;
