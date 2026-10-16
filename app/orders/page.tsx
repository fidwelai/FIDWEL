"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatNaira, orderStatusLabel, orderStatusTone } from "@/lib/orders";

type OrderRow = {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  currency: string;
  created_at: string;
  delivery_state: string | null;
  delivery_town: string | null;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (!user) {
        router.push("/login?next=" + encodeURIComponent("/orders"));
        return;
      }

      const { data } = await supabase
        .from("orders")
        .select(
          "id, status, payment_status, total, currency, created_at, delivery_state, delivery_town"
        )
        .order("created_at", { ascending: false });

      if (!active) {
        return;
      }

      setOrders((data as OrderRow[]) ?? []);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <Link href="/products" className="text-sm font-medium hover:text-green-700">
            ← Continue shopping
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold">My Orders</h1>

        {loading ? (
          <p className="mt-8 text-gray-500">Loading your orders...</p>
        ) : orders.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">📦</div>
            <h2 className="mt-4 text-xl font-bold">No orders yet</h2>
            <p className="mt-2 text-gray-600">
              When you place an order it will appear here with delivery tracking.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-block rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border bg-white p-5 shadow-sm transition hover:border-green-600"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatDate(order.created_at)}
                      {order.delivery_town || order.delivery_state
                        ? ` · ${[order.delivery_town, order.delivery_state]
                            .filter(Boolean)
                            .join(", ")}`
                        : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${orderStatusTone(
                          order.status
                        )}`}
                      >
                        {orderStatusLabel(order.status)}
                      </span>
                      {order.payment_status === "unpaid" && (
                        <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Payment due
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="shrink-0 font-bold text-green-700">
                    {formatNaira(order.total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
