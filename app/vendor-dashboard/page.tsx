"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type VendorProfile = {
  id: string;
  business_name: string;
  status: string;
  verified: boolean;
  state: string | null;
  lga: string | null;
  town: string | null;
};

export default function VendorDashboard() {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        window.location.replace(
          "/login?next=" +
            encodeURIComponent("/vendor-dashboard")
        );
        return;
      }

      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("id, business_name, status, verified, state, lga, town")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMessage(
          "We couldn't load your vendor profile. Please try again."
        );
        setLoading(false);
        return;
      }

      if (!data) {
        setMessage(
          "You haven't registered your business yet. Please complete vendor registration."
        );
        setLoading(false);
        return;
      }

      setVendor(data as VendorProfile);

      const [
        { count: total, error: totalError },
        { count: available, error: availableError },
        { count: unavailable, error: unavailableError },
      ] = await Promise.all([
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", data.id),

        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", data.id)
          .eq("is_available", true),

        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", data.id)
          .eq("is_available", false),
      ]);

      if (!totalError) setProductCount(total ?? 0);
      if (!availableError) setAvailableCount(available ?? 0);
      if (!unavailableError) setUnavailableCount(unavailable ?? 0);

      setLoading(false);
    }

    void loadDashboard();
  }, []);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage("Unable to sign out. Please try again.");
      return;
    }

    window.location.replace("/login");
  }

  const approved =
    vendor?.verified === true && vendor?.status === "active";

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="flex items-center justify-between border-b bg-white px-5 py-4 sm:px-8">
        <Link href="/" className="text-2xl font-bold text-green-700">
          FIDWEL
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Sign out
        </button>
      </nav>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="font-semibold text-green-700">VENDOR PORTAL</p>

        <h1 className="mt-2 text-3xl font-bold">
          Vendor Dashboard
        </h1>

        <p className="mt-2 text-gray-600">
          Manage your agricultural business on FIDWEL.
        </p>

        {loading ? (
          <p className="mt-8 text-gray-600">
            Loading your dashboard...
          </p>
        ) : message && !vendor ? (
          <div className="mt-8 rounded-2xl border bg-white p-6">
            <p className="text-gray-700">{message}</p>

            {message.includes("haven't registered") && (
              <Link
                href="/vendor/register"
                className="mt-4 inline-block rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
              >
                Register your business
              </Link>
            )}
          </div>
        ) : vendor ? (
          <>
            {message && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"
              >
                {message}
              </div>
            )}

            <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold">
                    {vendor.business_name}
                  </h2>

                  <p className="mt-2 text-sm text-gray-600">
                    {[vendor.town, vendor.lga, vendor.state]
                      .filter(Boolean)
                      .join(", ") || "Business location not provided"}
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
                    approved
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {approved
                    ? "Verified vendor"
                    : "Verification pending"}
                </span>
              </div>

              {!approved && (
                <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  Your business must be approved before you can
                  publish products on the marketplace.
                </p>
              )}
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  Total products
                </p>
                <p className="mt-2 text-3xl font-bold">
                  {productCount}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  Available products
                </p>
                <p className="mt-2 text-3xl font-bold text-green-700">
                  {availableCount}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  Unavailable products
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-500">
                  {unavailableCount}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">
                  Business status
                </p>
                <p className="mt-2 text-xl font-bold capitalize">
                  {vendor.status.replace(/_/g, " ")}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold">Quick actions</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Link
                  href="/vendor/products/new"
                  className="rounded-2xl border bg-white p-5 shadow-sm transition hover:border-green-600"
                >
                  <span className="text-2xl">📦</span>
                  <h3 className="mt-3 font-bold">Add a product</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Create a listing for your agricultural products.
                  </p>
                  {!approved && (
                    <p className="mt-2 text-sm font-medium text-amber-700">
                      Publishing requires approval
                    </p>
                  )}
                </Link>

                <Link
                  href="/vendor/products"
                  className="rounded-2xl border bg-white p-5 shadow-sm transition hover:border-green-600"
                >
                  <span className="text-2xl">🛒</span>
                  <h3 className="mt-3 font-bold">Manage products</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    View and manage your product listings.
                  </p>
                </Link>

                <Link
                  href="/vendor/orders"
                  className="rounded-2xl border bg-white p-5 shadow-sm transition hover:border-green-600"
                >
                  <span className="text-2xl">🧾</span>
                  <h3 className="mt-3 font-bold">Manage orders</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Track and fulfil items customers ordered from you.
                  </p>
                </Link>

                <Link
                  href="/vendor/analytics"
                  className="rounded-2xl border bg-white p-5 shadow-sm transition hover:border-green-600"
                >
                  <span className="text-2xl">📊</span>
                  <h3 className="mt-3 font-bold">Analytics</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    See your revenue, best-selling products and fulfilment.
                  </p>
                </Link>

                <Link
                  href="/vendor/subscription"
                  className="rounded-2xl border bg-white p-5 shadow-sm transition hover:border-green-600"
                >
                  <span className="text-2xl">⭐</span>
                  <h3 className="mt-3 font-bold">Subscription</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    View or change your vendor plan.
                  </p>
                </Link>

                <Link
                  href="/vendor/profile"
                  className="rounded-2xl border bg-white p-5 shadow-sm transition hover:border-green-600"
                >
                  <span className="text-2xl">🏪</span>
                  <h3 className="mt-3 font-bold">Business profile</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Update your business information and location.
                  </p>
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
