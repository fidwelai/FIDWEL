This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment & payments

Copy `.env.example` to `.env.local` and fill in the values. Supabase and Paystack
keys are required for checkout and vendor billing to work.

### Paystack

1. In the Paystack dashboard (Settings → API Keys & Webhooks), copy your **public**
   and **secret** keys into `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` and
   `PAYSTACK_SECRET_KEY`.
2. Set the **webhook URL** to `https://<your-domain>/api/paystack/webhook` so
   successful charges are confirmed server-side even if the customer closes the
   tab. Locally, expose your dev server (e.g. with `ngrok`) and use that URL.
3. Amounts are charged in kobo (naira × 100) and verified server-side against the
   stored order total and currency before an order is marked paid.

Staff access uses the comma-separated `ADMIN_EMAILS` / `AGENT_EMAILS` allowlists;
scheduled tasks authenticate with `CRON_SECRET`.

### Notifications & email

Order, payment, vendor-approval, and subscription events create an in-app
notification (see the `/notifications` page) for the customer or vendor
affected. Email delivery is **optional**: when `RESEND_API_KEY` is unset every
email is skipped and in-app notifications still work. To turn email on, add a
Resend API key and a verified sender:

- `RESEND_API_KEY` — Resend API key.
- `NOTIFICATION_EMAIL_FROM` — sender, e.g. `FIDWEL <no-reply@fidwel.com>`.
- `NEXT_PUBLIC_SITE_URL` — absolute site URL, used to build links inside emails
  (without it, emails are sent without action buttons).

Read/unread notifications are served by `GET /api/notifications` and
`PATCH /api/notifications` (Bearer token required).

### Reviews & ratings

Buyers can review a product from its detail page once they have received the
order item. Reviews are public and shown with an average from the
`product_ratings` view. No extra configuration is required — the eligibility and
"one review per purchase" rules are enforced by Row Level Security (see
[`supabase/SCHEMA.md`](supabase/SCHEMA.md)).

### Product images

Vendors upload product photos from the add-product page. Files go to the public
`product-images` Storage bucket through `POST /api/uploads/product-image`, which
verifies the caller is an approved, active vendor before writing with the service
role (JPG/PNG/WebP, max 5 MB). No extra configuration is required — the bucket is
created by migration `202610150009_product_images.sql`.

### Vendor analytics

`/vendor/analytics` summarises a vendor's sales: revenue from paid orders, the
last 30 days, paid-order count, units sold, average order value, fulfilment
counts, and top products by revenue. It reads the vendor's own `order_items`
(embedding `orders`) under Row Level Security and aggregates in the browser, so
it needs no extra tables or configuration.

### Scheduled tasks (cron)

`GET /api/cron/maintenance` runs housekeeping and returns a JSON digest:

- expires paid vendor subscriptions whose billing period has ended;
- cancels unpaid orders older than 48 hours (`STALE_UNPAID_ORDER_HOURS`);
- reports counts of pending vendors, expired subscriptions, and stale orders.

Guard it with `CRON_SECRET`. The endpoint accepts either
`Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends) or an
`x-cron-secret` header. It returns `503` when `CRON_SECRET` is unset and `401`
when the secret is missing or wrong.

Schedule it however you deploy — a daily call is enough:

- **Vercel** — already wired in [`vercel.json`](vercel.json) (`crons` entry calling
  `/api/cron/maintenance` daily at 06:00 UTC; Hobby plans allow daily schedules).
- **Others** — cron-job.org, GitHub Actions, or Supabase `pg_cron` calling the
  URL with the `Authorization` header.

## Deployment

Any Node host that runs `next build` / `next start` works. Vercel is the
zero-config path:

1. Push this repo to GitHub and import it at
   [vercel.com/new](https://vercel.com/new). Next.js is detected automatically.
2. Set the environment variables below in the Vercel project (Project → Settings →
   Environment Variables). Only the two `NEXT_PUBLIC_*` values are required for
   the app to boot; the rest unlock payments, email, cron, and staff tools.

   | Variable | Required | Purpose |
   |----------|----------|---------|
   | `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase API URL (browser + server). |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Public (publishable/anon) key. |
   | `SUPABASE_SECRET_KEY` | yes | Server-only key that bypasses RLS. Never expose. |
   | `PAYSTACK_SECRET_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | for payments | Enable online checkout. |
   | `RESEND_API_KEY` / `NOTIFICATION_EMAIL_FROM` | for email | Transactional email (in-app notifications work without it). |
   | `NEXT_PUBLIC_SITE_URL` | for email links | Absolute site URL, e.g. `https://fidwel.com`. |
   | `CRON_SECRET` | for cron | Shared secret guarding `/api/cron/maintenance`. |
   | `ADMIN_EMAILS` / `AGENT_EMAILS` | for staff | Comma-separated staff email allowlists. |

3. Paystack: set the webhook to `https://<your-domain>/api/paystack/webhook`.
4. Cron: `vercel.json` schedules `/api/cron/maintenance`; provide its
   `CRON_SECRET` and Vercel sends it automatically as a Bearer token.
5. Apply database migrations to your Supabase project with
   `supabase db push --linked` (see [`supabase/README.md`](supabase/README.md)).

See [`.env.example`](.env.example) for the full annotated list.

