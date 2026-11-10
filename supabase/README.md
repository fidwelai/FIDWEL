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
`202610150009_product_images.sql` (the `product-images` Storage bucket),
`202610150010_avatars.sql` (the `avatars` Storage bucket and its pre-auth upload
policy), `202610150011_vendor_verification_reports.sql` (agent field reports
with admin review), and `202610170001_location_based_delivery_agents.sql`
(location-based delivery agent profiles, assignment, and tracking).

Marketplace listings are returned by `GET /api/public/products`, which exposes
only approved products from active, verified vendors and can filter by vendor
state. The home-page location choice is saved in browser storage and applied to
that filter. This is state-level matching, not GPS-distance or route matching.

Agent verification reports are submitted through `POST /api/agent/reports`.
Agents can report only on vendors attributed to them; reports are read by their
author and admins. Admins can add review notes and mark reports reviewed, but
vendor approval remains a separate admin moderation action.

Delivery agents can register a state/LGA service area, receive matching paid
orders, and advance delivery status from the agent workspace. Customer-facing
delivery status and agent details are available on the order page. This workflow
uses service-area matching, not GPS live tracking.

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

## End-to-end workflow test

Use the FIDWEL Vercel Preview deployment and test accounts, not production
checkout or real customer/vendor records. The FIDWEL Preview Paystack public and
secret keys should both be configured for test mode.

1. Sign in to Preview with an account on the `ADMIN_EMAILS` allowlist. Open
   `/agent`; admins can use the agent workspace for testing. Set a delivery
   service area and copy the vendor referral link.
2. In a separate browser profile, create a test user from that referral link and
   submit a vendor application with clearly identified test-business details.
3. Back in the agent workspace, refresh the page, submit a field report for the
   referred pending vendor, and confirm the report appears at `/admin/reports`.
   Review the report, then separately approve the vendor at `/admin/vendors`.
4. Sign in as the test vendor and add a clearly labeled test product at
   `/vendor/products/new`. Active, verified vendors' new products are published
   immediately, so only use test inventory that is safe to show in Preview.
5. In a separate customer account, add the test product to the cart and check
   out with a Paystack test card. Use a delivery state and LGA matching the
   agent's saved service area.
6. As the vendor, mark the order items shipped. As the agent, confirm pickup,
   start delivery, and mark it delivered. Check the customer's order page for
   the updated delivery status.
7. Remove or disable the test product and test accounts/data when finished.

Do not use a live Paystack card or place test listings in Production. Vendor
approval and field-report review are separate admin actions.
