"use client";

import Link from "next/link";

const benefits = [
  {
    icon: "📍",
    title: "Shop by location",
    description: "Discover agricultural products and sellers serving your area.",
  },
  {
    icon: "✓",
    title: "Look for verified sellers",
    description: "Use FIDWEL's seller verification details when choosing a vendor.",
  },
  {
    icon: "🌾",
    title: "Know what you're buying",
    description: "Compare product descriptions, prices, units, and availability.",
  },
];

const steps = [
  {
    number: "01",
    title: "Choose your area",
    description: "Set your location so you can find produce relevant to your delivery area.",
    href: "/products",
    link: "Choose location and browse",
  },
  {
    number: "02",
    title: "Find fresh produce",
    description: "Explore categories, compare listings, and add the products you need to your cart.",
    href: "/products",
    link: "Explore marketplace",
  },
  {
    number: "03",
    title: "Place and follow your order",
    description: "Continue to checkout, then return to your orders to follow fulfilment updates.",
    href: "/orders",
    link: "View orders",
  },
];

export default function MarketplaceTrustSections() {
  return (
    <div className="space-y-10 sm:space-y-14">
      <section
        aria-label="FIDWEL marketplace benefits"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
      >
        {benefits.map((benefit) => (
          <article
            key={benefit.title}
            className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-xl text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {benefit.icon}
            </span>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{benefit.title}</h3>
              <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-slate-300">
                {benefit.description}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section
        id="how-it-works"
        className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-5 sm:p-8 md:p-10 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/40"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
            Simple from start to finish
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-gray-950 sm:text-3xl dark:text-white">
            How FIDWEL works
          </h2>
          <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base dark:text-slate-300">
            A clearer way to discover local agricultural products and manage your order.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <article
              key={step.number}
              className="flex flex-col rounded-2xl border border-white bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-sm font-extrabold text-white">
                {step.number}
              </span>
              <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">
                {step.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-gray-600 dark:text-slate-300">
                {step.description}
              </p>
              <Link
                href={step.href}
                className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                {step.link}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-emerald-950 px-6 py-7 text-white sm:px-9 sm:py-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full border-[28px] border-emerald-800/50"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 right-40 h-48 w-48 rounded-full border-[24px] border-lime-400/10"
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
              For farmers, growers and agro-sellers
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Bring your products to more local buyers.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-100 sm:text-base">
              Create a vendor account to start the registration process, manage your listings, and reach customers through FIDWEL.
            </p>
          </div>
          <Link
            href="/vendor/register"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-lime-300 px-6 py-3 text-sm font-extrabold text-emerald-950 shadow-sm transition hover:bg-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-200 focus:ring-offset-2 focus:ring-offset-emerald-950"
          >
            Become a vendor <span className="ml-2" aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
