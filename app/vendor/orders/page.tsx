"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  FULFILLMENT_TIMELINE,
  formatNaira,
  fulfillmentLabel,
  fulfillmentTone,
  orderStatusLabel,
  orderStatusTone,
} from "@/lib/orders";

type EmbeddedOrder = {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
  contact_name: string | null;
  contact_phone: string | null;
  delivery_state: string | null;
  delivery_lga: string | null;
  delivery_town: string | null;
  delivery_address: string | null;
  notes: string | null;
};

type VendorOrderItem = {
  id: number;
  order_id: string;
  product_name: string;
  unit: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  fulfillment_status: string;
  orders: EmbeddedOrder | null;
};

type Group = {
  order: EmbeddedOrder;
  items: VendorOrderItem[];
};

type RawOrderItem = Omit<VendorOrderItem, "orders"> & {
  orders: EmbeddedOrder | EmbeddedOrder[] | null;
};

const STATUS_OPTIONS = [...FULFILLMENT_TIMELINE, "cancelled"] as const;

function normalizeOrder(value: EmbeddedOrder | EmbeddedOrder[] | null): EmbeddedOrder | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function groupByOrder(items: RawOrderItem[]): Group[] {
  const map = new Map<string, Group>();

  for (const raw of items) {
    const order = normalizeOrder(raw.orders);

    if (!order) {
      continue;
    }

    const item: VendorOrderItem = { ...raw, orders: order };
    const existing = map.get(raw.order_id);

    if (existing) {
      existing.items.push(item);
    } else {
      map.set(raw.order_id, { order, items: [item] });
    }
  }

  return [...map.values()];
}

export default function VendorOrdersPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

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
        router.push("/login?next=" + encodeURIComponent("/vendor/orders"));
        return;
      }

      const { data: vendor } = await supabase
        .from("vendor_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (!vendor) {
        setMessage("You need a vendor profile to manage orders.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("order_items")
        .select(
          "id, order_id, product_name, unit, unit_price, quantity, line_total, fulfillment_status, orders(id, status, payment_status, created_at, contact_name, contact_phone, delivery_state, delivery_lga, delivery_town, delivery_address, notes)"
        )
        .eq("vendor_id", vendor.id)
        .order("order_id", { ascending: false });

      if (!active) {
        return;
      }

      if (error) {
        setMessage("We could not load your orders. Please try again.");
        setLoading(false);
        return;
      }

      setGroups(groupByOrder((data as unknown as RawOrderItem[]) ?? []));
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  async function updateStatus(item: VendorOrderItem, status: string) {
    if (status === item.fulfillment_status) {
      return;
    }

    setMessage("");
    setBusyId(item.id);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login?next=" + encodeURIComponent("/vendor/orders"));
      return;
    }

    try {
      const response = await fetch("/api/vendor/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ itemId: item.id, status }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { orderStatus?: string; error?: string }
        | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "Could not update the item.");
        return;
      }

      setGroups((current) =>
        current.map((group) => ({
          order: group.order.id === item.order_id
            ? { ...group.order, status: payload?.orderStatus ?? group.order.status }
            : group.order,
          items: group.items.map((row) =>
            row.id === item.id ? { ...row, fulfillment_status: status } : row
          ),
        }))
      );
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/vendor-dashboard" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <Link href="/vendor-dashboard" className="text-sm font-medium hover:text-green-700">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold">Orders</h1>
        <p className="mt-2 text-gray-600">
          Manage the items customers have ordered from your business.
        </p>

        {message && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            {message}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-gray-500">Loading your orders...</p>
        ) : groups.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">🧾</div>
            <h2 className="mt-4 text-xl font-bold">No orders yet</h2>
            <p className="mt-2 text-gray-600">
              Orders containing your products will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {groups.map((group) => (
              <div key={group.order.id} className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold">
                      Order #{group.order.id.slice(0, 8).toUpperCase()}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {new Date(group.order.created_at).toLocaleString("en-NG")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${orderStatusTone(
                        group.order.status
                      )}`}
                    >
                      {orderStatusLabel(group.order.status)}
                    </span>
                    <span
                      className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${
                        group.order.payment_status === "paid"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {group.order.payment_status === "paid" ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">
                    {group.order.contact_name || "Customer"}
                    {group.order.contact_phone ? ` · ${group.order.contact_phone}` : ""}
                  </p>
                  {group.order.delivery_address && <p>{group.order.delivery_address}</p>}
                  <p>
                    {[
                      group.order.delivery_town,
                      group.order.delivery_lga,
                      group.order.delivery_state,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {group.order.notes && <p className="mt-1 text-gray-500">Note: {group.order.notes}</p>}
                </div>

                <ul className="mt-4 divide-y">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">{item.product_name}</p>
                        <p className="text-sm text-gray-500">
                          {formatNaira(item.unit_price)} / {item.unit} × {item.quantity}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${fulfillmentTone(
                            item.fulfillment_status
                          )}`}
                        >
                          {fulfillmentLabel(item.fulfillment_status)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold">{formatNaira(item.line_total)}</span>
                        <select
                          value={item.fulfillment_status}
                          disabled={busyId === item.id}
                          onChange={(event) => void updateStatus(item, event.target.value)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {fulfillmentLabel(option)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
