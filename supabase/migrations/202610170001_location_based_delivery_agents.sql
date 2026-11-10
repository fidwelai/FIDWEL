-- Location-based FIDWEL delivery agents.
-- Apply after 202610150010_avatars.sql. Agent profiles are provisioned by the
-- existing /api/agent/session allowlist/role gate; an agent opts in by saving
-- a delivery service area in the agent portal.

create table if not exists public.delivery_agent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  state text not null,
  lga text not null,
  town text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_agent_state_nonempty check (length(trim(state)) > 0),
  constraint delivery_agent_lga_nonempty check (length(trim(lga)) > 0)
);

create index if not exists delivery_agent_area_idx
  on public.delivery_agent_profiles (lower(trim(state)), lower(trim(lga)), is_active);

alter table public.delivery_agent_profiles enable row level security;

drop policy if exists "Agents can view their delivery profile" on public.delivery_agent_profiles;
create policy "Agents can view their delivery profile"
on public.delivery_agent_profiles for select to authenticated
using (user_id = auth.uid());

drop trigger if exists delivery_agent_profiles_set_updated_at on public.delivery_agent_profiles;
create trigger delivery_agent_profiles_set_updated_at
before update on public.delivery_agent_profiles
for each row execute function public.set_updated_at();

alter table public.orders
  add column if not exists delivery_agent_id uuid references auth.users (id) on delete set null,
  add column if not exists delivery_status text not null default 'pending';

alter table public.orders
  drop constraint if exists orders_delivery_status_check;

alter table public.orders
  add constraint orders_delivery_status_check
  check (delivery_status in ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed'));

create index if not exists orders_delivery_agent_idx
  on public.orders (delivery_agent_id, delivery_status);

create index if not exists orders_unassigned_paid_area_idx
  on public.orders (payment_status, delivery_status, delivery_state, delivery_lga)
  where delivery_agent_id is null;

-- Called after payment is confirmed. Prefer a town-specific agent; otherwise
-- use an active agent covering the exact state + LGA. No location guessing.
create or replace function public.assign_delivery_agent_for_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_agent uuid;
begin
  if new.payment_status <> 'paid' or new.delivery_agent_id is not null then
    return new;
  end if;

  select dap.user_id
    into matched_agent
  from public.delivery_agent_profiles dap
  where dap.is_active = true
    and lower(trim(dap.state)) = lower(trim(coalesce(new.delivery_state, '')))
    and lower(trim(dap.lga)) = lower(trim(coalesce(new.delivery_lga, '')))
    and (nullif(trim(dap.town), '') is null
      or lower(trim(dap.town)) = lower(trim(coalesce(new.delivery_town, ''))))
  order by
    case when nullif(trim(dap.town), '') is not null then 0 else 1 end,
    dap.created_at asc
  limit 1;

  if matched_agent is not null then
    new.delivery_agent_id := matched_agent;
    new.delivery_status := 'assigned';
  else
    new.delivery_status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_assign_delivery_agent on public.orders;
create trigger orders_assign_delivery_agent
before update of payment_status on public.orders
for each row
when (new.payment_status = 'paid' and old.payment_status is distinct from new.payment_status)
execute function public.assign_delivery_agent_for_order();

-- Orders inserted as paid by trusted server paths are also covered.
drop trigger if exists orders_assign_delivery_agent_on_insert on public.orders;
create trigger orders_assign_delivery_agent_on_insert
before insert on public.orders
for each row
when (new.payment_status = 'paid')
execute function public.assign_delivery_agent_for_order();

-- This function can be called by a trusted server route after an agent saves
-- their service area, to assign older paid orders that were previously waiting.
create or replace function public.assign_waiting_deliveries_for_agent(target_agent_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_agent public.delivery_agent_profiles%rowtype;
  affected integer := 0;
begin
  select * into matched_agent
  from public.delivery_agent_profiles
  where user_id = target_agent_user_id and is_active = true;

  if not found then
    return 0;
  end if;

  update public.orders o
  set delivery_agent_id = matched_agent.user_id,
      delivery_status = 'assigned'
  where o.payment_status = 'paid'
    and o.delivery_agent_id is null
    and lower(trim(coalesce(o.delivery_state, ''))) = lower(trim(matched_agent.state))
    and lower(trim(coalesce(o.delivery_lga, ''))) = lower(trim(matched_agent.lga))
    and (nullif(trim(matched_agent.town), '') is null
      or lower(trim(coalesce(o.delivery_town, ''))) = lower(trim(matched_agent.town)));

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.assign_waiting_deliveries_for_agent(uuid) from public, anon, authenticated;
grant execute on function public.assign_waiting_deliveries_for_agent(uuid) to service_role;

comment on column public.orders.delivery_agent_id is 'auth.users.id of the FIDWEL delivery agent assigned by state/LGA/town.';
comment on column public.orders.delivery_status is 'Delivery lifecycle, independent from vendor order-item fulfillment.';
