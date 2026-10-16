"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PLANS, getPlan } from "@/lib/plans";
import { formatNaira } from "@/lib/orders";
import { loadPaystack } from "@/lib/paystack";

type Subscription = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

export default function VendorSubscriptionPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";
  const currentPlanId = subscription?.plan ?? "free";
  const currentPlan = getPlan(currentPlanId);

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
        router.push("/login?next=" + encodeURIComponent("/vendor/subscription"));
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
        setMessage("You need a vendor profile to manage a subscription.");
        setLoading(false);
        return;
      }

      setVendorId(vendor.id);
      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("vendor_subscriptions")
        .select("plan, status, current_period_end")
        .eq("vendor_id", vendor.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      setSubscription((data as Subscription) ?? null);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  async function choosePlan(planId: string) {
    const plan = getPlan(planId);

    if (!plan || !vendorId || plan.price <= 0) {
      return;
    }

    if (!paystackKey) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login?next=" + encodeURIComponent("/vendor/subscription"));
      return;
    }

    setBusyPlan(planId);
    setMessage("Opening secure payment...");

    try {
      await loadPaystack();
    } catch {
      setMessage("Could not open payment. Please try again.");
      setBusyPlan(null);
      return;
    }

    const handler = window.PaystackPop?.setup({
      key: paystackKey,
      email,
      amount: Math.round(plan.price * 100),
      currency: "NGN",
      metadata: { type: "vendor_subscription", vendorId, plan: plan.id },
      callback: async (response) => {
        setMessage("Activating your subscription...");
        try {
          const verify = await fetch("/api/vendor/subscription/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ plan: plan.id, reference: response.reference }),
          });

          if (!verify.ok) {
            setMessage("We could not activate your subscription. Contact support.");
            setBusyPlan(null);
            return;
          }
        } catch {
          setMessage("Network error while activating. Contact support if you were charged.");
          setBusyPlan(null);
          return;
        }

        window.location.reload();
      },
      onClose: () => {
        setBusyPlan(null);
        setMessage("");
      },
    });

    handler?.openIframe();
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
        <h1 className="text-3xl font-bold">Subscription</h1>
        <p className="mt-2 text-gray-600">
          Choose the plan that fits your business. Plans are billed monthly.
        </p>

        {loading ? (
          <p className="mt-8 text-gray-500">Loading your plan...</p>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">Current plan</p>
              <p className="mt-1 text-2xl font-bold">{currentPlan?.name ?? currentPlanId}</p>
              {subscription?.status && (
                <p className="mt-1 text-sm capitalize text-gray-500">
                  Status: {subscription.status}
                </p>
              )}
              {subscription?.current_period_end && (
                <p className="text-sm text-gray-500">
                  Renews {new Date(subscription.current_period_end).toLocaleDateString("en-NG")}
                </p>
              )}
            </div>

            {message && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                {message}
              </div>
            )}

            {!paystackKey && (
              <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
                Online billing is not configured yet. Paid plans will be available once
                payments are enabled.
              </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const canBuy = plan.price > 0 && paystackKey && !isCurrent;

                return (
                  <div
                    key={plan.id}
                    className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                      isCurrent ? "border-green-600" : "border-gray-200"
                    }`}
                  >
                    <h2 className="text-lg font-bold">{plan.name}</h2>
                    <p className="mt-1 text-sm text-gray-600">{plan.tagline}</p>
                    <p className="mt-4 text-3xl font-bold">
                      {plan.price === 0 ? "Free" : formatNaira(plan.price)}
                      {plan.price > 0 && (
                        <span className="text-base font-normal text-gray-500"> /mo</span>
                      )}
                    </p>

                    <ul className="mt-5 flex-1 space-y-2 text-sm text-gray-700">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <span className="text-green-700">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <span className="mt-6 block rounded-xl border border-green-600 px-4 py-3 text-center font-semibold text-green-700">
                        Current plan
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canBuy || busyPlan === plan.id}
                        onClick={() => void choosePlan(plan.id)}
                        className="mt-6 rounded-xl bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyPlan === plan.id
                          ? "Processing..."
                          : plan.price === 0
                            ? "Included"
                            : `Choose ${plan.name}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
