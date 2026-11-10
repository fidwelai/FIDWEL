"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const PORTALS = {
  admin: {
    title: "Admin console",
    label: "Admin",
    links: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/vendors", label: "Vendors" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/reports", label: "Field reports" },
      { href: "/agent", label: "Agent workspace" },
    ],
  },
  agent: {
    title: "Agent portal",
    label: "Agent",
    links: [
      { href: "/agent", label: "Agent workspace" },
      { href: "/agent#delivery-area", label: "Delivery area" },
      { href: "/agent#assigned-deliveries", label: "Assigned deliveries" },
      { href: "/agent#vendor-referrals", label: "Vendor referrals" },
      { href: "/agent#field-verification", label: "Field verification" },
    ],
  },
  vendor: {
    title: "Vendor portal",
    label: "Vendor",
    links: [
      { href: "/vendor-dashboard", label: "Dashboard" },
      { href: "/vendor/products/new", label: "Add a product" },
      { href: "/vendor/products", label: "Manage products" },
      { href: "/vendor/orders", label: "Orders" },
      { href: "/vendor/analytics", label: "Analytics" },
      { href: "/vendor/subscription", label: "Subscription" },
      { href: "/vendor/profile", label: "Business profile" },
    ],
  },
} as const;

type Portal = keyof typeof PORTALS;

export default function PortalNavigation({ portal }: { portal: Portal }) {
  const config = PORTALS[portal];
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setSigningOut(true);
    setError("");

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch (caught) {
      console.error("Portal sign-out error:", caught);
      setError("Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <nav
      aria-label={`${config.title} navigation`}
      className="border-b border-gray-200 bg-white px-5 py-3 sm:px-8"
    >
      <div className="mx-auto flex min-h-11 max-w-6xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link href="/" className="shrink-0 text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <span className="hidden border-l border-gray-200 pl-4 text-sm text-gray-600 sm:inline">
            {config.title}
          </span>
        </div>

        <details
          ref={menuRef}
          className="group relative shrink-0"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              menuRef.current?.removeAttribute("open");
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary
            aria-label={`${config.label} menu`}
            className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5 text-green-800"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 19a4 4 0 0 0-8 0m8 0H6m10 0h2a2 2 0 0 0 2-2v-1a8 8 0 1 0-16 0v1a2 2 0 0 0 2 2h2m4-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
              />
            </svg>
            <span>{config.label} menu</span>
            <svg
              aria-hidden="true"
              className="h-4 w-4 transition-transform group-open:rotate-180"
              fill="none"
              viewBox="0 0 20 20"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m5 7.5 5 5 5-5"
              />
            </svg>
          </summary>

          <div className="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {config.title}
            </p>
            <div className="max-h-[min(60vh,28rem)] overflow-y-auto">
              {config.links.map((item) => {
                const href = item.href.split("#")[0];
                const isCurrent =
                  !item.href.includes("#") &&
                  (pathname === href ||
                    (href !== "/admin" &&
                      href !== "/agent" &&
                      href !== "/vendor-dashboard" &&
                      pathname.startsWith(`${href}/`)));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-xl px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 ${
                      isCurrent
                        ? "bg-green-50 font-semibold text-green-800"
                        : "text-gray-700 hover:bg-gray-50 hover:text-green-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="mt-2 border-t border-gray-200 pt-2">
              <Link
                href="/"
                className="flex min-h-11 items-center rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
              >
                Marketplace
              </Link>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="flex min-h-11 w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-wait disabled:opacity-60"
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
              {error && (
                <p role="alert" className="px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
            </div>
          </div>
        </details>
      </div>
    </nav>
  );
}
