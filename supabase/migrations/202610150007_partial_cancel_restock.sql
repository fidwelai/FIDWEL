-- FIDWEL partial cancellation restock
--
-- Apply after 202610150006_notifications.sql. 202610150005 restocked a whole
-- order when its status became 'cancelled'. When a vendor cancels a *single*
-- item in a mixed order, that item's stock is released immediately by the
-- vendor route; the whole-order trigger must then skip items that were already
-- cancelled so they are never restocked twice.

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
     and item.product_id = product.id
     and item.fulfillment_status <> 'cancelled';

  return new;
end;
$$;

-- Re-assert the trigger (the function it calls was replaced above; this keeps
-- the migration idempotent).
drop trigger if exists orders_restock_on_cancel on public.orders;
create trigger orders_restock_on_cancel
after update on public.orders
for each row
when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
execute function public.restock_cancelled_order();
