"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useStaffSession } from "@/lib/use-staff-session";
import { STALE_UNPAID_ORDER_HOURS } from "@/lib/orders";

type Stats = {
  pendingVendors: number;
  activeVendors: number;
  totalVendors: number;
  pendingProducts: number;
  totalProducts: number;
  totalOrders: number;
  expiredSubscriptions: number;
  staleUnpaidOrders: number;
};

type PendingVendor = {
  id: string;
  business_name: string;
  state: string | null;
  town: string | null;
  created_at: string;
};

export default function AdminDashboardPage() {
  const session = useStaffSession("admin", "/admin");
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingVendor[]>([]);

  useEffect(() => {
    if (!session.authorized) {
      return;
    }

    let active = true;

    async function load() {
      const staleCutoffIso = new Date(
        Date.now() - STALE_UNPAID_ORDER_HOURS * 60 * 60 * 1000
      ).toISOString();

      const [
        pendingVendors,
        activeVendors,
        totalVendors,
        pendingProducts,
        totalProducts,
        totalOrders,
        expiredSubscriptions,
        staleUnpaidOrders,
        recent,
      ] = await Promise.all([
        supabase
          .from("vendor_profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("vendor_profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase.from("vendor_profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("approval_status", "pending"),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase
          .from("vendor_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "expired"),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .eq("payment_status", "unpaid")
          .lt("created_at", staleCutoffIso),
        supabase
          .from("vendor_profiles")
          .select("id, business_name, state, town, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (!active) {
        return;
      }

      setStats({
        pendingVendors: pendingVendors.count ?? 0,
        activeVendors: activeVendors.count ?? 0,
        totalVendors: totalVendors.count ?? 0,
        pendingProducts: pendingProducts.count ?? 0,
        totalProducts: totalProducts.count ?? 0,
        totalOrders: totalOrders.count ?? 0,
        expiredSubscriptions: expiredSubscriptions.count ?? 0,
        staleUnpaidOrders: staleUnpaidOrders.count ?? 0,
      });

      setPending((recent.data as PendingVendor[]) ?? []);
    }

    void load();

    return () => {
      active = false;
    };
  }, [session.authorized]);

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <span className="text-sm text-gray-500">Admin console</span>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="mt-2 text-gray-600">
          Approve vendors and listings, and keep an eye on the marketplace.
        </p>

        {session.loading ? (
          <p className="mt-8 text-gray-500">Checking access...</p>
        ) : !session.authorized ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold">Admins only</h2>
            <p className="mt-2 text-gray-600">
              Your account is not authorized for the admin console.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
            >
              Back to marketplace
            </Link>
          </div>
        ) : (
          <>
            {(stats?.expiredSubscriptions ?? 0) > 0 ||
            (stats?.staleUnpaidOrders ?? 0) > 0 ? (
              <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <h2 className="text-lg font-bold text-amber-900">Needs attention</h2>
                <ul className="mt-3 space-y-1 text-sm text-amber-800">
                  {(stats?.expiredSubscriptions ?? 0) > 0 && (
                    <li>
                      {stats?.expiredSubscriptions} vendor subscription
                      {stats?.expiredSubscriptions === 1 ? "" : "s"} expired —
                      follow up to renew.
                    </li>
                  )}
                  {(stats?.staleUnpaidOrders ?? 0) > 0 && (
                    <li>
                      {stats?.staleUnpaidOrders} unpaid order
                      {stats?.staleUnpaidOrders === 1 ? "" : "s"} older than{" "}
                      {STALE_UNPAID_ORDER_HOURS}h — follow up, or the maintenance
                      job will cancel {stats?.staleUnpaidOrders === 1 ? "it" : "them"}.
                    </li>
                  )}
                </ul>
              </div>
            ) : null}

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/admin/vendors"
                className="rounded-2xl border bg-white p-6 shadow-sm transition hover:border-green-600"
              >
                <p className="text-sm text-gray-500">Pending vendors</p>
                <p className="mt-2 text-3xl font-bold text-amber-600">
                  {stats?.pendingVendors ?? "—"}
                </p>
                <p className="mt-1 text-xs text-gray-400">Tap to review</p>
              </Link>

              <Link
                href="/admin/products"
                className="rounded-2xl border bg-white p-6 shadow-sm transition hover:border-green-600"
              >
                <p className="text-sm text-gray-500">Pending products</p>
                <p className="mt-2 text-3xl font-bold text-amber-600">
                  {stats?.pendingProducts ?? "—"}
                </p>
                <p className="mt-1 text-xs text-gray-400">Tap to review</p>
              </Link>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Total orders</p>
                <p className="mt-2 text-3xl font-bold">{stats?.totalOrders ?? "—"}</p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Active vendors</p>
                <p className="mt-2 text-3xl font-bold text-green-700">
                  {stats?.activeVendors ?? "—"}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Total vendors</p>
                <p className="mt-2 text-3xl font-bold">{stats?.totalVendors ?? "—"}</p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Total products</p>
                <p className="mt-2 text-3xl font-bold">{stats?.totalProducts ?? "—"}</p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Latest pending vendors</h2>
                <Link href="/admin/vendors" className="text-sm font-medium text-green-700">
                  View all
                </Link>
              </div>

              {pending.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No vendors are waiting for review.</p>
              ) : (
                <ul className="mt-4 divide-y">
                  {pending.map((vendor) => (
                    <li key={vendor.id} className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <p className="font-semibold">{vendor.business_name}</p>
                        <p className="text-sm text-gray-500">
                          {[vendor.town, vendor.state].filter(Boolean).join(", ") ||
                            "Location not provided"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">
                        {new Date(vendor.created_at).toLocaleDateString("en-NG")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
