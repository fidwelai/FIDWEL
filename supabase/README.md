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
(location-based delivery agent profiles, assignment, and tracking), and
`202610180001_vendor_storefront_sales_tracking.sql` (shareable vendor stores
and paid sales attribution).

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

Active, verified vendors have a public store at `/store/{sales_tracking_id}`.
The store displays only their approved, available products. Product visits from
a store link retain the vendor's tracking ID in that browser for 30 days.
Checkout attributes a paid order to that vendor only when the order includes
one of their products; the vendor dashboard totals paid attributed orders and
the line-item sales value for the vendor's own products. This metric is sales
attribution, not a commission or payout calculation. The migration must be
applied before the store links and attribution can be used.

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

**Live-data warning:** FIDWEL Preview and Production both use the same Supabase
project. Preview signups, vendor applications, products, and orders are stored
in the live database, and a test product may appear on the public marketplace.
Proceed only with explicit approval to create test records in that shared
database. Preview Paystack uses test keys; this does not isolate database
writes.

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
   immediately and may appear on the public Production marketplace. Use only
   test inventory that is safe to display publicly.
5. From `/vendor-dashboard`, copy the public store link and open it in a
   separate browser profile. Confirm the test product appears, add it to the
   cart, and complete checkout with a Paystack test card. Use a delivery state
   and LGA matching the agent's saved service area.
6. As the vendor, mark the order items shipped. As the agent, confirm pickup,
   start delivery, and mark it delivered. Check the customer's order page for
   the updated delivery status. Confirm the vendor dashboard counts the order
   and the vendor's product subtotal after payment is confirmed.
7. Test records persist in the shared live database. Remove test listings
   through the app where possible, and have an administrator clean up remaining
   test accounts, reports, and orders using their exact test identifiers.

Never use a live Paystack card or real customer/vendor information. Vendor
approval and field-report review are separate admin actions.
