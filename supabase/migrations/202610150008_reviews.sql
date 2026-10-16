-- FIDWEL product reviews
--
-- Apply after 202610150007_partial_cancel_restock.sql. A customer can review a
-- product only from one of their own delivered order items, and only once per
-- purchased line. Reviews are public to read; only the author (or an admin) can
-- change or remove one.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.products (id) on delete cascade,
  reviewer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  order_item_id bigint unique references public.order_items (id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_product_id_idx on public.reviews (product_id);
create index if not exists reviews_reviewer_id_idx on public.reviews (reviewer_id);

-- True only when the given order item belongs to the reviewer, is delivered, and
-- is for the product being reviewed. SECURITY DEFINER so the policy can inspect
-- orders/order_items the reviewer can read anyway, without widening access.
create or replace function public.review_matches_purchase(
  target_reviewer uuid,
  target_order_item bigint,
  target_product bigint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.order_items item
    join public.orders ord on ord.id = item.order_id
    where item.id = target_order_item
      and item.product_id = target_product
      and item.fulfillment_status = 'delivered'
      and ord.customer_id = target_reviewer
  );
$$;

-- A review is tied to the purchase it came from; a signed-in user cannot move it.
create or replace function public.protect_review_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and (
    new.product_id is distinct from old.product_id
    or new.reviewer_id is distinct from old.reviewer_id
    or new.order_item_id is distinct from old.order_item_id
  ) then
    raise exception 'A review cannot be moved to another product or purchase';
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

drop trigger if exists reviews_identity_protected on public.reviews;
create trigger reviews_identity_protected
before update on public.reviews
for each row execute function public.protect_review_identity();

alter table public.reviews enable row level security;

drop policy if exists "Anyone can read reviews" on public.reviews;
create policy "Anyone can read reviews"
on public.reviews for select to anon, authenticated
using (true);

drop policy if exists "Customers can review delivered items" on public.reviews;
create policy "Customers can review delivered items"
on public.reviews for insert to authenticated
with check (
  reviewer_id = auth.uid()
  and public.review_matches_purchase(reviewer_id, order_item_id, product_id)
);

drop policy if exists "Authors can update their reviews" on public.reviews;
create policy "Authors can update their reviews"
on public.reviews for update to authenticated
using (reviewer_id = auth.uid())
with check (reviewer_id = auth.uid());

drop policy if exists "Authors can delete their reviews" on public.reviews;
create policy "Authors can delete their reviews"
on public.reviews for delete to authenticated
using (reviewer_id = auth.uid());

drop policy if exists "Admins can delete any review" on public.reviews;
create policy "Admins can delete any review"
on public.reviews for delete to authenticated
using (public.is_admin());

-- Public rating summary, one row per reviewed product.
create or replace view public.product_ratings
with (security_invoker = true)
as
  select
    product_id,
    count(*)::int as review_count,
    round(avg(rating)::numeric, 2) as average_rating
  from public.reviews
  group by product_id;

grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant select on public.product_ratings to anon, authenticated;
grant execute on function public.review_matches_purchase(uuid, bigint, bigint) to authenticated;
