"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/orders";

type EmbeddedOrder = {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
};

type RawItem = {
  id: number;
  product_id: number | null;
  product_name: string;
  unit: string;
  quantity: number;
  line_total: number;
  fulfillment_status: string;
  order_id: string;
  orders: EmbeddedOrder | EmbeddedOrder[] | null;
};

type TopProduct = {
  name: string;
  unit: string;
  units: number;
  revenue: number;
};

function normalizeOrder(
  value: EmbeddedOrder | EmbeddedOrder[] | null
): EmbeddedOrder | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

export default function VendorAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [revenue, setRevenue] = useState(0);
  const [revenue30, setRevenue30] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [unitsSold, setUnitsSold] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.push("/login?next=" + encodeURIComponent("/vendor/analytics"));
        return;
      }

      const { data: vendor } = await supabase
        .from("vendor_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      if (!vendor) {
        setMessage("You need a vendor profile to see analytics.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("order_items")
        .select(
          "id, product_id, product_name, unit, quantity, line_total, fulfillment_status, order_id, orders(payment_status, status, created_at)"
        )
        .eq("vendor_id", vendor.id)
        .order("id", { ascending: false });

      if (!active) return;

      if (error) {
        setMessage("We could not load your analytics. Please try again.");
        setLoading(false);
        return;
      }

      const items = (data as unknown as RawItem[]) ?? [];

      const paidOrders = new Set<string>();
      let paidRevenue = 0;
      let recentRevenue = 0;
      let units = 0;
      let pending = 0;
      let delivered = 0;
      let cancelled = 0;
      const products = new Map<string, TopProduct>();
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

      for (const item of items) {
        const order = normalizeOrder(item.orders);
        const isPaid = order?.payment_status === "paid";

        if (item.fulfillment_status === "cancelled") {
          cancelled += 1;
          continue;
        }

        if (item.fulfillment_status === "delivered") {
          delivered += 1;
        } else if (
          item.fulfillment_status === "pending" ||
          item.fulfillment_status === "processing"
        ) {
          pending += 1;
        }

        if (!isPaid) {
          continue;
        }

        paidOrders.add(item.order_id);
        paidRevenue += Number(item.line_total);
        units += Number(item.quantity);

        if (order && new Date(order.created_at).getTime() >= cutoff) {
          recentRevenue += Number(item.line_total);
        }

        const key = item.product_id ? String(item.product_id) : item.product_name;
        const current = products.get(key) ?? {
          name: item.product_name,
          unit: item.unit,
          units: 0,
          revenue: 0,
        };
        current.units += Number(item.quantity);
        current.revenue += Number(item.line_total);
        products.set(key, current);
      }

      if (!active) return;

      setRevenue(paidRevenue);
      setRevenue30(recentRevenue);
      setOrderCount(paidOrders.size);
      setUnitsSold(units);
      setPendingCount(pending);
      setDeliveredCount(delivered);
      setCancelledCount(cancelled);
      setTopProducts(
        [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
      );
      setHasData(items.length > 0);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/vendor-dashboard" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <Link
            href="/vendor-dashboard"
            className="text-sm font-medium hover:text-green-700"
          >
            ← Dashboard
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-2 text-gray-600">
          A summary of sales across the items customers ordered from your
          business.
        </p>

        {message && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            {message}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-gray-500">Loading your analytics...</p>
        ) : !hasData ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">📊</div>
            <h2 className="mt-4 text-xl font-bold">No sales data yet</h2>
            <p className="mt-2 text-gray-600">
              Analytics will appear once customers order your products.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Revenue (paid)</p>
                <p className="mt-2 text-2xl font-bold text-green-700">
                  {formatNaira(revenue)}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Last 30 days</p>
                <p className="mt-2 text-2xl font-bold">{formatNaira(revenue30)}</p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Paid orders</p>
                <p className="mt-2 text-2xl font-bold">{orderCount}</p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Units sold</p>
                <p className="mt-2 text-2xl font-bold">{unitsSold}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Average order value</p>
                <p className="mt-1 text-lg font-bold">
                  {formatNaira(averageOrderValue)}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Awaiting fulfilment</p>
                <p className="mt-1 text-lg font-bold text-amber-700">
                  {pendingCount}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Delivered items</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">
                  {deliveredCount}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Cancelled items</p>
                <p className="mt-1 text-lg font-bold text-gray-500">
                  {cancelledCount}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold">Top products</h2>

              {topProducts.length === 0 ? (
                <p className="mt-4 text-gray-600">
                  No paid items yet — top products appear once orders are paid.
                </p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Product</th>
                        <th className="px-5 py-3 text-right font-medium">Units</th>
                        <th className="px-5 py-3 text-right font-medium">
                          Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {topProducts.map((product) => (
                        <tr key={product.name}>
                          <td className="px-5 py-3 font-medium">
                            {product.name}
                            <span className="ml-1 text-xs font-normal text-gray-500">
                              / {product.unit}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {product.units}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold">
                            {formatNaira(product.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="mt-6 text-sm text-gray-500">
              Revenue counts paid, non-cancelled items. Delivered items are
              sales your customers have received.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
