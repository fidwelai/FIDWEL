"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ORDER_TIMELINE,
  formatNaira,
  fulfillmentLabel,
  fulfillmentTone,
  isYielding,
  orderStatusLabel,
  orderStatusTone,
} from "@/lib/orders";
import { loadPaystack, makeOrderReference } from "@/lib/paystack";

type OrderItem = {
  id: number;
  product_name: string;
  unit: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  fulfillment_status: string;
};

type Order = {
  id: string;
  status: string;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: string;
  created_at: string;
  contact_name: string | null;
  contact_phone: string | null;
  delivery_state: string | null;
  delivery_lga: string | null;
  delivery_town: string | null;
  delivery_address: string | null;
  notes: string | null;
  order_items: OrderItem[];
};

const TIMELINE: string[] = [...ORDER_TIMELINE];

function OrderDetailContent() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentProcessing = searchParams.get("payment") === "processing";

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [status, setStatus] = useState("");

  const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (!user) {
        router.push("/login?next=" + encodeURIComponent(`/orders/${orderId}`));
        return;
      }

      const { data, error: queryError } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (queryError || !data) {
        setError("We could not find this order.");
        setLoading(false);
        return;
      }

      setOrder(data as Order);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [orderId, router]);

  async function payNow() {
    if (!order) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.email) {
      router.push("/login?next=" + encodeURIComponent(`/orders/${order.id}`));
      return;
    }

    setPaying(true);
    setStatus("Opening secure payment...");

    try {
      await loadPaystack();
    } catch {
      setStatus("Could not open payment. Please try again.");
      setPaying(false);
      return;
    }

    const reference = makeOrderReference(order.id);

    const handler = window.PaystackPop?.setup({
      key: paystackKey,
      email: session.user.email,
      amount: Math.round(Number(order.total) * 100),
      currency: "NGN",
      ref: reference,
      metadata: { orderId: order.id },
      callback: async (response) => {
        setStatus("Confirming your payment...");
        try {
          const verifyResponse = await fetch("/api/paystack/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ reference: response.reference || reference }),
          });
          const verifyPayload = (await verifyResponse.json().catch(() => null)) as
            | { ok?: boolean }
            | null;

          if (!verifyResponse.ok || !verifyPayload?.ok) {
            router.push(`/orders/${order.id}?payment=processing`);
            return;
          }

          window.location.href = `/orders/${order.id}`;
        } catch {
          // The signed Paystack webhook can still reconcile the payment.
          router.push(`/orders/${order.id}?payment=processing`);
        }
      },
      onClose: () => {
        setPaying(false);
        setStatus("");
      },
    });

    handler?.openIframe();
  }

  if (loading) {
    return <p className="text-gray-500">Loading order...</p>;
  }

  if (error || !order) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <h2 className="text-xl font-bold">{error || "Order not found"}</h2>
        <Link
          href="/orders"
          className="mt-6 inline-block rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
        >
          Back to my orders
        </Link>
      </div>
    );
  }

  const currentIndex = TIMELINE.indexOf(order.status);
  const yielded = isYielding(order.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Placed {new Date(order.created_at).toLocaleString("en-NG")}
          </p>
        </div>
        <span
          className={`inline-block rounded-full border px-4 py-1.5 text-sm font-semibold ${orderStatusTone(
            order.status
          )}`}
        >
          {orderStatusLabel(order.status)}
        </span>
      </div>

      {paymentProcessing && order.payment_status !== "paid" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-bold text-amber-900">Payment confirmation in progress</h2>
          <p className="mt-1 text-sm text-amber-800">
            Paystack returned you to FIDWEL, but confirmation has not completed yet. Do not pay again while this message is shown.
          </p>
          <button
            onClick={() => {
              window.location.href = `/orders/${order.id}`;
            }}
            className="mt-4 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900"
          >
            Refresh payment status
          </button>
        </div>
      )}

      {order.payment_status === "unpaid" && !paymentProcessing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-bold text-amber-900">Payment due</h2>
          <p className="mt-1 text-sm text-amber-800">
            {paystackKey
              ? "Complete payment to confirm your order."
              : "Online payment is not available yet. This order is saved and payment can be arranged directly."}
          </p>
          {paystackKey && (
            <button
              onClick={payNow}
              disabled={paying}
              className="mt-4 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
            >
              {paying ? "Opening payment..." : `Pay ${formatNaira(order.total)}`}
            </button>
          )}
          {status && <p className="mt-3 text-sm text-amber-800">{status}</p>}
        </div>
      )}

      {!yielded && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">Delivery progress</h2>
          <ol className="mt-5 flex flex-wrap gap-3">
            {TIMELINE.map((step, index) => {
              const reached = currentIndex >= index;
              return (
                <li key={step} className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      reached ? "bg-green-700 text-white" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`text-sm ${reached ? "font-semibold text-gray-900" : "text-gray-400"}`}
                  >
                    {orderStatusLabel(step)}
                  </span>
                  {index < TIMELINE.length - 1 && (
                    <span className="hidden text-gray-300 sm:inline">→</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Items</h2>
            <ul className="mt-4 divide-y">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-3">
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
                  <span className="shrink-0 font-bold">
                    {formatNaira(item.line_total)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold">{formatNaira(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery</span>
                <span className="font-semibold">
                  {Number(order.delivery_fee) === 0
                    ? "Free"
                    : formatNaira(order.delivery_fee)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Total</span>
                <span className="text-green-700">{formatNaira(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Delivery</h2>
            <div className="mt-4 space-y-2 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">
                {order.contact_name || "—"}
              </p>
              {order.contact_phone && <p>{order.contact_phone}</p>}
              {order.delivery_address && <p>{order.delivery_address}</p>}
              <p>
                {[order.delivery_town, order.delivery_lga, order.delivery_state]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {order.notes && (
                <p className="mt-2 text-gray-500">Note: {order.notes}</p>
              )}
            </div>
          </div>

          <Link
            href="/orders"
            className="block rounded-2xl border bg-white p-4 text-center text-sm font-semibold text-green-700 shadow-sm hover:border-green-600"
          >
            ← Back to my orders
          </Link>
        </aside>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <Link href="/orders" className="text-sm font-medium hover:text-green-700">
            My orders
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <Suspense fallback={<p className="text-gray-500">Loading order...</p>}>
          <OrderDetailContent />
        </Suspense>
      </section>
    </main>
  );
}
