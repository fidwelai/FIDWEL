# FIDWEL database schema

Source of truth:
[`migrations/202610150001_foundation.sql`](migrations/202610150001_foundation.sql),
[`migrations/202610150002_orders.sql`](migrations/202610150002_orders.sql),
[`migrations/202610150003_vendor_orders_and_subscriptions.sql`](migrations/202610150003_vendor_orders_and_subscriptions.sql),
[`migrations/202610150004_admin_and_agents.sql`](migrations/202610150004_admin_and_agents.sql),
[`migrations/202610150005_product_stock.sql`](migrations/202610150005_product_stock.sql),
[`migrations/202610150006_notifications.sql`](migrations/202610150006_notifications.sql),
[`migrations/202610150007_partial_cancel_restock.sql`](migrations/202610150007_partial_cancel_restock.sql),
[`migrations/202610150008_reviews.sql`](migrations/202610150008_reviews.sql),
[`migrations/202610150009_product_images.sql`](migrations/202610150009_product_images.sql) and
[`migrations/202610150010_avatars.sql`](migrations/202610150010_avatars.sql).
This document mirrors those migrations. If they ever disagree, the migrations
win.

## Core ownership rule

`products.vendor_id` always references `vendor_profiles.id` — **never**
`auth.users.id`. A vendor's `auth.users.id` is stored only in
`vendor_profiles.user_id`. Every app write follows this rule: it looks up the
vendor profile by `user_id = auth.uid()` and writes the returned
`vendor_profiles.id` into `products.vendor_id`.

Public visibility is narrower than ownership: a listing is shown to shoppers
only when it is `approval_status = 'approved'`, `is_available = true`, **and**
its vendor is a "public vendor" (`status = 'active'` and `verified = true`).

---

## Tables

### `public.profiles`

One row per authenticated user, keyed by the auth user id.

| Column | Type | Null | Default | Constraints |
|--------|------|------|---------|-------------|
| `id` | `uuid` | no | — | PK, FK → `auth.users(id)` `on delete cascade` |
| `role` | `text` | no | `'customer'` | check in (`customer`, `vendor`, `agent`, `admin`) |
| `full_name` | `text` | yes | — | |
| `phone` | `text` | yes | — | |
| `avatar_url` | `text` | yes | — | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | maintained by trigger |

### `public.categories`

Starter product categories.

| Column | Type | Null | Default | Constraints |
|--------|------|------|---------|-------------|
| `id` | `bigint` | no | identity | PK |
| `name` | `text` | no | — | unique |
| `created_at` | `timestamptz` | no | `now()` | |

Seeded rows: Plantain, Fish, Yam, Cassava, Vegetables, Fruits, Meat.

### `public.vendor_profiles`

One row per registered vendor business.

| Column | Type | Null | Default | Constraints |
|--------|------|------|---------|-------------|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no | — | unique, FK → `auth.users(id)` `on delete cascade` |
| `business_name` | `text` | no | — | |
| `phone` | `text` | yes | — | |
| `description` | `text` | yes | — | |
| `state` | `text` | yes | — | |
| `lga` | `text` | yes | — | |
| `town` | `text` | yes | — | |
| `address` | `text` | yes | — | |
| `status` | `text` | no | `'pending'` | check in (`pending`, `active`, `suspended`, `rejected`) |
| `verified` | `boolean` | no | `false` | |
| `agent_id` | `uuid` | yes | — | FK → `auth.users(id)` `on delete set null`, added by `0004` |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | maintained by trigger |

`status` and `verified` are moderation fields managed by FIDWEL, not by vendors.

### `public.products`

Marketplace listings.

| Column | Type | Null | Default | Constraints |
|--------|------|------|---------|-------------|
| `id` | `bigint` | no | identity | PK |
| `vendor_id` | `uuid` | no | — | FK → `vendor_profiles(id)` `on delete cascade` |
| `category_id` | `bigint` | yes | — | FK → `categories(id)` `on delete set null` |
| `name` | `text` | no | — | |
| `description` | `text` | yes | — | |
| `price` | `numeric(12,2)` | no | — | check `price > 0` |
| `unit` | `text` | no | — | |
| `quantity_available` | `numeric(12,2)` | no | `0` | check `>= 0` |
| `image_url` | `text` | yes | — | |
| `is_available` | `boolean` | no | `true` | |
| `approval_status` | `text` | no | `'approved'` | check in (`pending`, `approved`, `rejected`) |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | maintained by trigger |

The migration also re-runs `alter table ... add column if not exists` for
`approval_status` and `is_available` so it is safe to apply on databases where
the tables already exist.

### `public.orders`

Customer orders placed at checkout. Created by `migrations/202610150002_orders.sql`.

| Column | Type | Null | Default | Constraints |
|--------|------|------|---------|-------------|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `customer_id` | `uuid` | no | — | FK → `auth.users(id)` `on delete restrict` |
| `status` | `text` | no | `'pending'` | check in (`pending`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`) |
| `payment_status` | `text` | no | `'unpaid'` | check in (`unpaid`, `paid`, `failed`, `refunded`) |
| `payment_provider` | `text` | no | `'paystack'` | |
| `payment_reference` | `text` | yes | — | |
| `currency` | `text` | no | `'NGN'` | |
| `subtotal` | `numeric(12,2)` | no | `0` | check `>= 0` |
| `delivery_fee` | `numeric(12,2)` | no | `0` | check `>= 0` |
| `total` | `numeric(12,2)` | no | `0` | check `>= 0` |
| `contact_name` | `text` | yes | — | |
| `contact_phone` | `text` | yes | — | |
| `delivery_state` | `text` | yes | — | |
| `delivery_lga` | `text` | yes | — | |
| `delivery_town` | `text` | yes | — | |
| `delivery_address` | `text` | yes | — | |
| `notes` | `text` | yes | — | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | maintained by trigger |

### `public.order_items`

Line items for an order. Each row snapshots the product name, unit, and price
**at purchase time**, so editing or deleting a product later never rewrites
order history.

| Column | Type | Null | Default | Constraints |
|--------|------|------|---------|-------------|
| `id` | `bigint` | no | identity | PK |
| `order_id` | `uuid` | no | — | FK → `orders(id)` `on delete cascade` |
| `product_id` | `bigint` | yes | — | FK → `products(id)` `on delete set null` |
| `vendor_id` | `uuid` | yes | — | FK → `vendor_profiles(id)` `on delete set null` |
| `product_name` | `text` | no | — | snapshot |
| `unit` | `text` | no | — | snapshot |
| `unit_price` | `numeric(12,2)` | no | — | check `>= 0`, snapshot |
| `quantity` | `numeric(12,2)` | no | — | check `> 0` |
| `line_total` | `numeric(12,2)` | no | — | check `>= 0` |
| `created_at` | `timestamptz` | no | `now()` | |

`order_items.vendor_id` follows the core ownership rule: it stores the
`vendor_profiles.id` of the product's owner (never `auth.users.id`). This is
what will let vendors read the orders that contain their listings once vendor
order-management policies are added.

### `public.delivery_agent_profiles`

One service-area profile per FIDWEL delivery agent. Agents save their state and LGA in the agent portal; an optional town narrows matching. The server uses the service role for writes and only returns agent contact details to the customer who owns the assigned order.

| Column | Type | Meaning |
|--------|------|---------|
| `id` | `uuid` | Profile primary key |
| `user_id` | `uuid` | Delivery agent's `auth.users.id`, unique |
| `state` | `text` | Required delivery state |
| `lga` | `text` | Required local government area |
| `town` | `text` | Optional narrower match |
| `phone` | `text` | Optional customer-facing delivery phone |
| `is_active` | `boolean` | Whether the agent can receive new assignments |

### Delivery fields on `public.orders`

- `delivery_agent_id`: nullable `auth.users.id` for the assigned FIDWEL agent.
- `delivery_status`: `pending`, `assigned`, `picked_up`, `in_transit`, `delivered`, or `failed`.
- Once an order payment changes to `paid`, a database trigger matches an active agent by case-insensitive state + LGA and prefers an exact town match.
- If no agent matches, the order remains `pending` until an agent activates a matching service area.
- Vendor item fulfilment remains separate from delivery status; agents cannot pick up an order until all items are marked shipped.

### `public.notifications`

In-app notification inbox for customers and vendors. Created by
`migrations/202610150006_notifications.sql`. Rows are written only by the
service role; each user reads and marks read their own rows.

| Column | Type | Null | Default | Constraints |
|--------|------|------|---------|-------------|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no | — | FK → `auth.users(id)` `on delete cascade` |
| `type` | `text` | no | — | event key, e.g. `order_placed`, `order_paid`, `vendor_approved`, `vendor_rejected`, `subscription_active` |
| `title` | `text` | no | — | |
| `body` | `text` | no | — | |
| `link` | `text` | yes | — | in-app path to open, e.g. `/orders/<id>` |
| `read_at` | `timestamptz` | yes | — | null means unread |
| `created_at` | `timestamptz` | no | `now()` | |

### `public.reviews`

Product reviews. Created by `migrations/202610150008_reviews.sql`. A review is
anchored to the delivered order item it came from, so only a real buyer can
review and only once per purchased line.

| Column | Type | Null | Default | Constraints |
|--------|------|------|---------|-------------|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `product_id` | `bigint` | no | — | FK → `products(id)` `on delete cascade` |
| `reviewer_id` | `uuid` | no | `auth.uid()` | FK → `auth.users(id)` `on delete cascade` |
| `order_item_id` | `bigint` | yes | — | **unique**, FK → `order_items(id)` `on delete set null` |
| `rating` | `integer` | no | — | check between `1` and `5` |
| `comment` | `text` | yes | — | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | maintained by trigger |

### `public.product_ratings` (view)

Public rating summary, one row per reviewed product, `security_invoker` so it
respects the `reviews` policies. Read-only.

| Column | Type | Meaning |
|--------|------|---------|
| `product_id` | `bigint` | product id |
| `review_count` | `integer` | number of reviews |
| `average_rating` | `numeric` | mean rating, rounded to 2 dp |

### Indexes

- `products_vendor_id_idx` on `products(vendor_id)`
- `products_public_listing_idx` on `products(approval_status, is_available, category_id)`
- `vendor_profiles_user_id_idx` on `vendor_profiles(user_id)`
- `orders_customer_id_idx` on `orders(customer_id)`
- `orders_status_idx` on `orders(status)`
- `order_items_order_id_idx` on `order_items(order_id)`
- `order_items_vendor_id_idx` on `order_items(vendor_id)`
- `order_items_fulfillment_status_idx` on `order_items(fulfillment_status)`
- `vendor_subscriptions_vendor_id_idx` on `vendor_subscriptions(vendor_id)`
- `vendor_profiles_agent_id_idx` on `vendor_profiles(agent_id)`
- `notifications_user_created_idx` on `notifications(user_id, created_at desc)`
- `notifications_user_unread_idx` on `notifications(user_id)` where `read_at is null`
- `reviews_product_id_idx` on `reviews(product_id)`
- `reviews_reviewer_id_idx` on `reviews(reviewer_id)`

---

## Functions and triggers

| Function | Trigger | Table / timing | Purpose |
|----------|---------|----------------|---------|
| `set_updated_at()` | `profiles_set_updated_at`, `vendor_profiles_set_updated_at`, `products_set_updated_at`, `orders_set_updated_at`, `reviews_set_updated_at` | `before update` on each table | Sets `updated_at = now()`. |
| `create_profile_for_new_user()` | `auth_user_profile_created` | `after insert` on `auth.users` | `SECURITY DEFINER`. Creates the `profiles` row for a new user and sets `role` from `raw_user_meta_data.account_type` (`vendor` → `vendor`, otherwise `customer`). `on conflict do nothing`. |
| `protect_profile_role()` | `profiles_role_protected` | `before update` on `profiles` | Blocks any role change made by a signed-in request (`auth.uid()` not null). Only admin/service-role (no `auth.uid()`) can change roles. |
| `protect_vendor_moderation_fields()` | `vendor_profiles_moderation_protected` | `before update` on `vendor_profiles` | Blocks changes to `user_id`, `status`, or `verified` by a signed-in request. |
| `protect_product_moderation_fields()` | `products_moderation_protected` | `before update` on `products` | Blocks changes to `vendor_id` or `approval_status` by a signed-in request. |
| `protect_order_financials()` | `orders_financials_protected` | `before update` on `orders` | Blocks changes to `status`, `payment_status`, `payment_reference`, `payment_provider`, `subtotal`, `delivery_fee`, `total`, or `customer_id` by a signed-in request. Only the payment webhook (service role, no `auth.uid()`) can advance payment and order status. |
| `is_public_vendor(uuid)` | — (helper) | — | `SECURITY DEFINER`, `STABLE`. Returns true when the given vendor profile is `status = 'active'` and `verified = true`. Used by the public browse policy so shoppers can check vendor status without reading vendor contact fields. |
| `is_admin()` | — (helper) | — | `SECURITY DEFINER`, `STABLE`. Returns true when the caller's `profiles.role = 'admin'`. Added by `0004` and used by all admin read policies. |
| `decrement_product_stock(bigint, numeric)` | — (helper) | — | `SECURITY DEFINER`. Atomically reserves stock with a conditional `update` (only when the listing is public and enough stock remains). Returns `false` when refused. Added by `0005`. |
| `increment_product_stock(bigint, numeric)` | — (helper) | — | `SECURITY DEFINER`. Releases reserved stock (checkout rollback). Added by `0005`. |
| `restock_cancelled_order()` | `orders_restock_on_cancel` | `after update` on `orders` | `SECURITY DEFINER`. When an order transitions into `cancelled`, adds each `order_items.quantity` back to its product — **except items already individually `cancelled`** (added by `0005`, refined by `0007`). |
| `review_matches_purchase(uuid, bigint, bigint)` | — (helper) | — | `SECURITY DEFINER`, `STABLE`. True only when the order item belongs to the reviewer, is `fulfillment_status = 'delivered'`, and is for the product being reviewed. Backs the review insert policy. Added by `0008`. |
| `protect_review_identity()` | `reviews_identity_protected` | `before update` on `reviews` | Blocks a signed-in request from moving a review to another `product_id`, `reviewer_id`, or `order_item_id`. Added by `0008`. |

> Note: role is set once, at signup, from the client-supplied
> `account_type` metadata. The same trigger does not run again for an existing
> user, so a customer who later registers a vendor business keeps
> `profiles.role = 'customer'`. Routing therefore treats the existence of a
> `vendor_profiles` row as the authoritative "this user is a vendor signal",
> and uses `profiles.role` for the non-vendor case.

---

## Row Level Security

RLS is enabled on `profiles`, `categories`, `vendor_profiles`, `products`,
`orders`, `order_items`, `notifications`, and `reviews`.

### `profiles`

| Policy | Command | Roles | Condition |
|--------|---------|-------|-----------|
| Users can view their own profile | `select` | authenticated | `id = auth.uid()` |
| Users can update their own profile | `update` | authenticated | `using id = auth.uid()` / `with check id = auth.uid()` |
| Admins can view all profiles | `select` | authenticated | `is_admin()` |

### `categories`

| Policy | Command | Roles | Condition |
|--------|---------|-------|-----------|
| Anyone can browse categories | `select` | anon, authenticated | `true` |

### `vendor_profiles`

| Policy | Command | Roles | Condition |
|--------|---------|-------|-----------|
| Users can view their vendor profile | `select` | authenticated | `user_id = auth.uid()` |
| Users can register one vendor profile | `insert` | authenticated | `user_id = auth.uid() and status = 'pending' and verified = false` |
| Vendors can update their own profile | `update` | authenticated | `using user_id = auth.uid()` / `with check user_id = auth.uid()` |
| Agents can view referred vendors | `select` | authenticated | `agent_id = auth.uid()` |
| Admins can view all vendors | `select` | authenticated | `is_admin()` |

The `insert` policy forces `status = 'pending'` and `verified = false`, so a
vendor cannot self-approve at registration. The `update` policy allows editing
business details, but the `protect_vendor_moderation_fields()` trigger rejects
any attempt to change `status` or `verified`.

### `products`

| Policy | Command | Roles | Condition |
|--------|---------|-------|-----------|
| Anyone can browse approved products | `select` | anon, authenticated | `approval_status = 'approved' and is_available = true and is_public_vendor(vendor_id)` |
| Vendors can view their own products | `select` | authenticated | vendor profile with `id = products.vendor_id` and `user_id = auth.uid()` |
| Approved vendors can add products | `insert` | authenticated | `approval_status = 'approved'` and vendor profile `id = products.vendor_id`, `user_id = auth.uid()`, `status = 'active'`, `verified = true` |
| Vendors can update their own products | `update` | authenticated | `using`/`with check` vendor profile `id = products.vendor_id` and `user_id = auth.uid()` |
| Vendors can delete their own products | `delete` | authenticated | vendor profile `id = products.vendor_id` and `user_id = auth.uid()` |
| Admins can view all products | `select` | authenticated | `is_admin()` |

### Approval model

New listings from an **active, verified** vendor are approved immediately:
the insert policy requires `approval_status = 'approved'` and the app writes
that value explicitly. A vendor cannot insert while pending — the insert policy
requires an active, verified vendor — and cannot later change `approval_status`
because the moderation trigger blocks it. Suspending a vendor hides their
listings from shoppers without deleting them, because the public browse policy
requires `is_public_vendor(vendor_id)`.

### `orders`

| Policy | Command | Roles | Condition |
|--------|---------|-------|-----------|
| Customers can view their own orders | `select` | authenticated | `customer_id = auth.uid()` |
| Customers can create their own orders | `insert` | authenticated | `customer_id = auth.uid() and status = 'pending' and payment_status = 'unpaid'` |
| Customers can update their own orders | `update` | authenticated | `using customer_id = auth.uid()` / `with check customer_id = auth.uid()` |
| Vendors can view orders containing their items | `select` | authenticated | `vendor_has_order(id)` |
| Admins can view all orders | `select` | authenticated | `is_admin()` |

The `insert` policy forces new orders to start as `pending` / `unpaid`. The
`update` policy lets a customer fix delivery details, but the
`protect_order_financials()` trigger rejects any change to totals, status, or
payment fields.

### `order_items`

| Policy | Command | Roles | Condition |
|--------|---------|-------|-----------|
| Customers can view their own order items | `select` | authenticated | `order_items.order_id` belongs to an order with `customer_id = auth.uid()` |
| Customers can create items for their own orders | `insert` | authenticated | parent order has `customer_id = auth.uid()` and `status = 'pending'` |
| Vendors can view their own items | `select` | authenticated | `vendor_id = current_vendor_profile_id()` |
| Admins can view all order items | `select` | authenticated | `is_admin()` |

Fulfillment and financial **writes** never come from these policies — vendors
and admins only read. Changes are routed through the service-role route handlers
(`/api/vendor/orders`, `/api/admin/*`).

### `vendor_subscriptions`

RLS is enabled on `vendor_subscriptions`. Vendors can select their own row;
admins can read all rows via `is_admin()`. Writes run only through the
service-role routes.

### `notifications`

| Policy | Command | Roles | Condition |
|--------|---------|-------|-----------|
| Users can view their own notifications | `select` | authenticated | `user_id = auth.uid()` |
| Users can mark their notifications read | `update` | authenticated | `using user_id = auth.uid()` / `with check user_id = auth.uid()` |

There is no `insert` policy: notifications are created only by the service role
(which bypasses RLS), so a user can never forge a notification for someone else.

### `reviews`

| Policy | Command | Roles | Condition |
|--------|---------|-------|-----------|
| Anyone can read reviews | `select` | anon, authenticated | `true` |
| Customers can review delivered items | `insert` | authenticated | `reviewer_id = auth.uid()` and `review_matches_purchase(reviewer_id, order_item_id, product_id)` |
| Authors can update their reviews | `update` | authenticated | `using`/`with check` `reviewer_id = auth.uid()` |
| Authors can delete their reviews | `delete` | authenticated | `reviewer_id = auth.uid()` |
| Admins can delete any review | `delete` | authenticated | `is_admin()` |

The insert policy is the trust boundary: `review_matches_purchase` confirms the
`order_item_id` belongs to the caller's order, is `delivered`, and is for the
reviewed `product_id`. The `order_item_id` unique constraint limits a buyer to
one review per purchased line, and `protect_review_identity()` stops a signed-in
author from re-pointing an existing review at another product or purchase.

---

## Admin and agent access

Added by `202610150004_admin_and_agents.sql`.

### Provisioning

Admins and agents are provisioned through environment allowlists:

- `ADMIN_EMAILS` — comma-separated list. When a user on this list signs in,
  the server promotes their `profiles.role` to `'admin'`.
- `AGENT_EMAILS` — same, promoting to `'agent'`.

Promotion is done by `/api/admin/session` and `/api/agent/session` using the
service-role key, so it bypasses the `protect_profile_role()` trigger (which
blocks signed-in role changes). The alternative, if you prefer not to use env
lists, is a one-time SQL update by a service-role connection:

```sql
update public.profiles set role = 'admin' where id = '<auth.users.id>';
```

### What admins can do

`/admin`, `/admin/vendors`, and `/admin/products` (client) call the
service-role routes:

- `POST /api/admin/vendors` — `{ vendorId, action }` where action is
  `approve`, `reject`, `suspend`, or `reactivate`. Sets
  `status` and `verified` together (`approve`/`reactivate` → `active` + verified;
  `reject`/`suspend` → `rejected`/`suspended` + not verified).
- `POST /api/admin/products` — `{ productId, action }` where action is
  `approve` or `reject`. Sets `approval_status`.

These routes authenticate the caller (Bearer token), require an admin, then
use the service-role client, which is the only actor allowed to change the
moderation fields (`protect_vendor_moderation_fields` and
`protect_product_moderation_fields` block signed-in users).

### What agents can do

Agents are acquisition partners. On `/agent` they get a referral link:

```
/vendor/register?ref=<agent's auth.users.id>
```

The vendor register page reads `?ref=` on load, stores it in
`localStorage` (so it survives the login redirect back to registration), and
writes it to `vendor_profiles.agent_id`. If the id is not a valid agent, the
insert is retried without `agent_id` so a bad link never blocks registration.

Agents can list the vendors they referred (`agent_id = auth.uid()`) and see
their status. Agents **cannot** approve vendors or moderate listings.

---

## Grants

```sql
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products to anon, authenticated;
grant select, update on public.profiles, public.vendor_profiles, public.products to authenticated;
grant insert on public.vendor_profiles, public.products to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_public_vendor(uuid) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_vendor_profile_id() to authenticated;
grant execute on function public.vendor_has_order(uuid) to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;
grant select on public.vendor_subscriptions to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant select on public.product_ratings to anon, authenticated;
grant execute on function public.review_matches_purchase(uuid, bigint, bigint) to authenticated;
```

---

## Checkout and payments

Checkout is server-driven. The browser sends the cart to `POST /api/orders`
with the user's Supabase access token; the route handler re-reads product
prices and availability from the database, computes the delivery fee
(`>= ₦25,000` is free, otherwise `₦1,500`), **reserves stock for each line**
(see [Product stock](#product-stock)), then inserts the `orders` and
`order_items` rows with the service-role client (`SUPABASE_SECRET_KEY`). Order
totals are never trusted from the client.

Payment uses Paystack:

- The browser opens the Paystack popup with `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
  using a unique reference per attempt (prefixed with the order id so the charge
  can still be traced back). A fresh reference is needed because Paystack rejects
  a reference that has already been used.
- `POST /api/paystack/verify` re-verifies the transaction with
  `PAYSTACK_SECRET_KEY`, checks the paid amount against `orders.total`, and
  marks the order paid.
- `POST /api/paystack/webhook` verifies the `x-paystack-signature` HMAC and
  marks the order paid as a backstop.

Because `protect_order_financials` blocks signed-in users from changing
`status`, `payment_status`, `payment_reference`, and totals, all payment
updates run through the service-role secret key (no `auth.uid()`), never from
the client.

## Vendor orders and subscriptions

Added by `202610150003_vendor_orders_and_subscriptions.sql`.

### `order_items.fulfillment_status`

Each order item carries its own `fulfillment_status`
(`pending`, `processing`, `shipped`, `delivered`, `cancelled`). A single order
can contain items from several vendors, so fulfillment is tracked per item and
each vendor only advances their own items. The order-level `status` is a
summary kept in sync by the server: all delivered → `delivered`, all cancelled
→ `cancelled`, any shipped → `shipped`, any processing → `processing`.

### Vendor read access

Two `security definer` helpers back the new policies:

- `public.current_vendor_profile_id()` returns the caller's
  `vendor_profiles.id`.
- `public.vendor_has_order(order_id)` is true when the order contains at least
  one item owned by the caller.

Policies:

- `order_items`: vendors select rows where
  `vendor_id = current_vendor_profile_id()`.
- `orders`: vendors select rows where `vendor_has_order(id)`.

Vendors do **not** get insert/update grants on `orders` or `order_items`.
Fulfillment changes go through `POST /api/vendor/orders`, which authenticates
the caller, verifies the item belongs to their vendor profile, updates
`fulfillment_status`, and recomputes the order status with the service-role
key (bypassing `protect_order_financials`).

### `vendor_subscriptions`

One row per vendor (`vendor_id` is unique): `plan`, `status`, `amount`,
`currency`, `billing_interval`, `current_period_start/end`, and
`payment_reference`. Plans are defined in `lib/plans.ts` (Free, plus paid
monthly tiers — placeholder pricing). Vendors can select their own row; writes
run through `POST /api/vendor/subscription/verify`, which verifies the Paystack
transaction and upserts the subscription with the service-role key. The
Paystack webhook also activates subscriptions from `charge.success` events
whose metadata has `type = 'vendor_subscription'`.

## Not created by this migration

- Paystack keys and the deployed webhook URL. Configure them in the hosting
  environment (see `.env.example`).
- Paystack subscription plans and recurring billing. Subscriptions are
  currently activated one month at a time from a successful charge; true
  Paystack recurring plans can be layered on later.

## Product stock

Added by `202610150005_product_stock.sql`. `products.quantity_available` is
reserved at checkout and returned when an order is cancelled, so the same unit
can never be sold twice.

- **Reserve.** `POST /api/orders` calls `decrement_product_stock(id, qty)` per
  line. The function performs a conditional `update ... where quantity_available
  >= qty and is_available and approval_status = 'approved'`, which is atomic, so
  concurrent shoppers cannot oversell the last unit. If any line is refused, the
  route calls `increment_product_stock` for the lines already reserved and
  returns `409`; the order is not created.
- **Release on failure.** If the order or item insert fails after reserving, the
  route releases everything it reserved.
- **Restock on cancel.** The `orders_restock_on_cancel` trigger adds reserved
  quantities back when an order's status becomes `cancelled` — including when
  the maintenance cron cancels a stale unpaid order, and when a vendor cancels
  every item in an order. It **skips items whose `fulfillment_status` is already
  `cancelled`** (see below), so nothing is returned twice.
- **Per-item cancellation.** When a vendor cancels a *single* item in a mixed
  order, `POST /api/vendor/orders` releases that item's reserved stock
  immediately (`increment_product_stock`). Reopening a cancelled item reserves
  its stock again and is refused with `409` when there is not enough left.
  Because the order-level trigger skips already-cancelled items, a later
  whole-order cancel never double-restocks the ones already returned.

Both helpers are `SECURITY DEFINER` and called with the service role (the same
key used by `/api/orders`). The trigger-body change (skip cancelled items) was
added by `202610150007_partial_cancel_restock.sql`.

## Scheduled maintenance

`GET /api/cron/maintenance` (guarded by `CRON_SECRET`) periodically mutates two
sets of rows with the service role, bypassing `protect_order_financials`:

- `vendor_subscriptions` — `active` rows past `current_period_end` become
  `expired`.
- `orders` — `pending` + `unpaid` rows older than `STALE_UNPAID_ORDER_HOURS`
  (48h, in `lib/orders.ts`) become `cancelled`.

It also returns digest counts (pending vendors, expired subscriptions, stale
orders) that the admin dashboard mirrors as a "Needs attention" reminder.

## Notifications

Added by `202610150006_notifications.sql`. `lib/notify.ts` writes an in-app
notification (and, when configured, an email) for the affected user whenever a
domain event happens. It is **best-effort**: a missing row, missing email config,
or a provider error never breaks the request that triggered it.

| Event | `type` | Triggered from |
|-------|--------|----------------|
| Order placed | `order_placed` | `POST /api/orders` |
| Payment confirmed | `order_paid` | `POST /api/paystack/verify`, `POST /api/paystack/webhook` |
| Vendor approved / reactivated | `vendor_approved` | `POST /api/admin/vendors` |
| Vendor rejected | `vendor_rejected` | `POST /api/admin/vendors` |
| Subscription activated | `subscription_active` | `POST /api/vendor/subscription/verify`, webhook |

In-app rows are read with `GET /api/notifications` and marked read with
`PATCH /api/notifications` (both require the caller's Bearer token). The
`/notifications` page lists them and shows an unread count.

Email is sent through Resend (`lib/email.ts`) only when `RESEND_API_KEY` is set,
using the sender in `NOTIFICATION_EMAIL_FROM` and links built from
`NEXT_PUBLIC_SITE_URL` (emails omit action buttons when it is unset).

## Reviews and ratings

Added by `202610150008_reviews.sql`. Customers can review a product they have
received, from the product detail page (`app/products/[id]/page.tsx`).

- **Eligibility.** The page lists the signed-in user's `delivered` order items
  for the product (via `order_items` + `orders!inner`), minus any the user has
  already reviewed. The form only appears when there is an unreviewed purchase.
- **Trust.** Writes go straight to `reviews` under RLS; the insert policy calls
  `review_matches_purchase` so a review can only be attached to the caller's own
  delivered line. The unique `order_item_id` prevents duplicates, and
  `protect_review_identity()` keeps a review tied to its original purchase.
- **Display.** Reviews are public; the page also reads `product_ratings` for the
  average and count. Reviewer names are not shown — the UI labels every review
  "Verified buyer" so no other user's profile has to be exposed.

## Product images

Added by `202610150009_product_images.sql`. Vendor product photos live in the
public Storage bucket `product-images`.

- **Bucket.** `product-images` is public (world-readable) with a 5 MB
  `file_size_limit` and `allowed_mime_types` of `image/jpeg`, `image/png`, and
  `image/webp`.
- **Writes are server-only.** No `storage.objects` policies are granted to `anon`
  or `authenticated`, so clients cannot list or upload directly. Objects are
  written by `POST /api/uploads/product-image`, which authenticates the caller,
  verifies they are an approved, active vendor, validates the MIME type and size,
  and uploads with the service role under `<vendor_id>/<uuid>.<ext>`.
- **Reads.** The returned public URL
  (`/storage/v1/object/public/product-images/...`) is stored in
  `products.image_url`. The add and edit product pages
  (`app/vendor/products/new/page.tsx`, `app/vendor/products/[id]/edit/page.tsx`)
  upload on selection and still accept a pasted external URL as a fallback.

## Avatars

Added by `202610150010_avatars.sql`. Profile pictures from the registration page
live in the public Storage bucket `avatars`.

- **Bucket.** `avatars` is public (world-readable) with a 2 MB `file_size_limit`
  and `allowed_mime_types` of `image/jpeg`, `image/png`, and `image/webp`.
- **Pre-auth upload.** `app/register/page.tsx` uploads the picture **before**
  signup (email confirmation may be enabled, so there is no session yet). The
  policy `Anonymous avatar uploads` therefore allows `anon`/`authenticated`
  inserts, but only with `bucket_id = 'avatars'` and `name like 'public/%'`, and
  only INSERT (no anonymous update). The page uploads with `upsert: false` to a
  path that already includes a timestamp and random suffix, so every write is a
  new object.
- **Trade-off.** This is the tightest scope the pre-auth flow allows, but it does
  permit unauthenticated uploads of small images. If registration later uploads
  after sign-in, drop the policy and require `auth.uid()`.
