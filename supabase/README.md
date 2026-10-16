# Supabase schema

Full schema reference: [`SCHEMA.md`](SCHEMA.md) (tables, triggers, RLS policies,
grants, and the approval model). This README covers the ownership rules and how
to apply the migration.

The SQL migrations in `migrations/` are the source of truth for the current
FIDWEL schema: `202610150001_foundation.sql` (profiles, vendors, products),
`202610150002_orders.sql` (orders and order items for checkout and tracking),
`202610150003_vendor_orders_and_subscriptions.sql` (per-item fulfillment,
vendor order access, and vendor subscriptions),
`202610150004_admin_and_agents.sql` (admin moderation access and vendor
acquisition agents), `202610150005_product_stock.sql` (stock reservation),
`202610150006_notifications.sql` (in-app notification inbox),
`202610150007_partial_cancel_restock.sql` (per-item cancel restock),
`202610150008_reviews.sql` (product reviews and ratings),
`202610150009_product_images.sql` (the `product-images` Storage bucket), and
`202610150010_avatars.sql` (the `avatars` Storage bucket and its pre-auth upload
policy).

Checkout payments run through server route handlers that use the
`SUPABASE_SECRET_KEY` (service role) and Paystack keys. Admin and agent access
is provisioned through the `ADMIN_EMAILS` and `AGENT_EMAILS` allowlists. Copy
`.env.example` to `.env.local` and fill in the values before testing checkout
or staff tools.

It defines these ownership rules:

- `profiles.id` is the authenticated user's ID and stores the application role.
- `vendor_profiles.id` identifies the vendor business.
- `products.vendor_id` references `vendor_profiles.id`.
- New listings from active, verified vendors are approved immediately; only
  approved, available listings from those vendors are public.

Before applying it to an existing database, inspect `products.vendor_id`. If it
currently stores `auth.users.id` values, migrate those values to the matching
`vendor_profiles.id` values first. Do not apply the ownership foreign key until
that data has been converted.

Apply migrations through the Supabase CLI after linking the intended project:

```powershell
supabase db push
```

Use the Supabase SQL editor if you are not using the CLI. The migrations create
tables, triggers, indexes, RLS policies, starter categories, and the
`product-images` and `avatars` Storage buckets (the latter with a narrowly scoped
pre-auth upload policy for the registration page).
