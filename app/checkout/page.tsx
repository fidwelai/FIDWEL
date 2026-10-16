"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import { computeDeliveryFee, formatNaira } from "@/lib/orders";
import { loadPaystack, makeOrderReference } from "@/lib/paystack";

type CheckoutForm = {
  contact_name: string;
  contact_phone: string;
  state: string;
  lga: string;
  town: string;
  address: string;
  notes: string;
};

const EMPTY_FORM: CheckoutForm = {
  contact_name: "",
  contact_phone: "",
  state: "",
  lga: "",
  town: "",
  address: "",
  notes: "",
};

const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-600";

export default function CheckoutPage() {
  const { items, count, subtotal, clear } = useCart();
  const router = useRouter();
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [email, setEmail] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  const deliveryFee = computeDeliveryFee(subtotal);
  const orderTotal = subtotal + deliveryFee;
  const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) {
        return;
      }

      if (!user) {
        router.push("/login?next=" + encodeURIComponent("/checkout"));
        return;
      }

      setEmail(user.email ?? "");
      setForm((current) => ({
        ...current,
        contact_name: current.contact_name || (user.user_metadata?.full_name as string) || "",
        contact_phone: current.contact_phone || (user.user_metadata?.phone as string) || "",
      }));
      setCheckingAuth(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  function updateField(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function startPayment(orderId: string, amount: number) {
    try {
      await loadPaystack();
    } catch {
      router.push(`/orders/${orderId}`);
      return;
    }

    const reference = makeOrderReference(orderId);

    const handler = window.PaystackPop?.setup({
      key: paystackKey,
      email,
      amount: Math.round(amount * 100),
      currency: "NGN",
      ref: reference,
      metadata: { orderId },
      callback: async (response) => {
        setStatus("Confirming your payment...");
        try {
          await fetch("/api/paystack/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: response.reference || reference, orderId }),
          });
        } catch {
          // The webhook will reconcile the payment if this call fails.
        }
        router.push(`/orders/${orderId}`);
      },
      onClose: () => {
        router.push(`/orders/${orderId}`);
      },
    });

    handler?.openIframe();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login?next=" + encodeURIComponent("/checkout"));
      return;
    }

    setSubmitting(true);

    let order: { id: string; total: number } | null = null;

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          delivery: form,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { order?: { id: string; total: number }; error?: string }
        | null;

      if (!response.ok || !payload?.order) {
        setStatus(payload?.error ?? "We could not place your order. Please try again.");
        setSubmitting(false);
        return;
      }

      order = payload.order;
    } catch {
      setStatus("Network error. Please check your connection and try again.");
      setSubmitting(false);
      return;
    }

    clear();

    if (paystackKey && order.total > 0) {
      setStatus("Opening secure payment...");
      await startPayment(order.id, order.total);
      return;
    }

    router.push(`/orders/${order.id}`);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <Link href="/cart" className="text-sm font-medium hover:text-green-700">
            ← Back to cart
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold">Checkout</h1>

        {count === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold">Your cart is empty</h2>
            <Link
              href="/products"
              className="mt-6 inline-block rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
            >
              Browse products
            </Link>
          </div>
        ) : checkingAuth ? (
          <p className="mt-8 text-gray-500">Loading your details...</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold">Delivery details</h2>

                <div className="mt-5 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block font-medium">Full name *</label>
                      <input
                        name="contact_name"
                        value={form.contact_name}
                        onChange={updateField}
                        className={inputClass}
                        placeholder="Who is receiving the order?"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block font-medium">Phone number *</label>
                      <input
                        name="contact_phone"
                        value={form.contact_phone}
                        onChange={updateField}
                        className={inputClass}
                        placeholder="e.g. 08012345678"
                        type="tel"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block font-medium">State *</label>
                      <input
                        name="state"
                        value={form.state}
                        onChange={updateField}
                        className={inputClass}
                        placeholder="e.g. Bayelsa"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block font-medium">LGA</label>
                      <input
                        name="lga"
                        value={form.lga}
                        onChange={updateField}
                        className={inputClass}
                        placeholder="Local government area"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block font-medium">Town or community</label>
                    <input
                      name="town"
                      value={form.town}
                      onChange={updateField}
                      className={inputClass}
                      placeholder="Town or community"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-medium">Delivery address *</label>
                    <textarea
                      name="address"
                      value={form.address}
                      onChange={updateField}
                      className={inputClass}
                      placeholder="Street, landmark, and any directions"
                      rows={3}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-medium">Order notes</label>
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={updateField}
                      className={inputClass}
                      placeholder="Anything the vendor or rider should know (optional)"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold">Payment</h2>
                <p className="mt-2 text-sm text-gray-600">
                  {paystackKey
                    ? "You will pay securely with Paystack after reviewing your order."
                    : "Online payment is being set up. Your order will be saved and you can pay from your order details."}
                </p>
              </div>
            </div>

            <aside className="h-fit rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">Order Summary</h2>

              <ul className="mt-4 space-y-2 text-sm">
                {items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span className="text-gray-600">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-semibold">
                      {formatNaira(item.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-2 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold">{formatNaira(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery</span>
                  <span className="font-semibold">
                    {deliveryFee === 0 ? "Free" : formatNaira(deliveryFee)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>Total</span>
                  <span className="text-green-700">{formatNaira(orderTotal)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 block w-full rounded-xl bg-green-700 px-4 py-3 text-center font-semibold text-white hover:bg-green-800 disabled:opacity-60"
              >
                {submitting ? "Placing order..." : "Place Order"}
              </button>

              {status && (
                <p role="status" className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  {status}
                </p>
              )}
            </aside>
          </form>
        )}
      </section>
    </main>
  );
}
