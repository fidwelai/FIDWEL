"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PortalNavigation from "@/components/PortalNavigation";

type VendorProfile = {
  id: string;
  business_name: string;
  status: string;
  verified: boolean;
  state: string | null;
  lga: string | null;
  town: string | null;
};

type SalesTrackingSummary = {
  trackingId: string;
  attributedOrders: number;
  attributedSales: number;
};

export default function VendorDashboard() {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [salesTracking, setSalesTracking] = useState<SalesTrackingSummary | null>(null);
  const [trackingMessage, setTrackingMessage] = useState("");
  const [copiedStoreUrl, setCopiedStoreUrl] = useState(false);

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

      const { data: authSession, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setTrackingMessage("We couldn't verify your session to load sales tracking.");
      } else if (authSession.session) {
        try {
          const response = await fetch("/api/vendor/sales-tracking", {
            headers: { Authorization: `Bearer ${authSession.session.access_token}` },
            cache: "no-store",
          });
          const payload = (await response.json()) as
            | SalesTrackingSummary
            | { error?: string };
          if (!response.ok || !("trackingId" in payload)) {
            setTrackingMessage(
              "error" in payload
                ? payload.error ?? "We couldn't load attributed sales."
                : "We couldn't load attributed sales."
            );
          } else {
            setSalesTracking(payload);
            setStoreUrl(`${window.location.origin}/store/${payload.trackingId}`);
          }
        } catch (caught) {
          console.error("Vendor sales tracking request failed:", caught);
          setTrackingMessage("We couldn't load attributed sales. Please refresh and try again.");
        }
      }

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

  const approved =
    vendor?.verified === true && vendor?.status === "active";
  const canShareStore = approved && Boolean(storeUrl);

  async function copyStoreUrl() {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopiedStoreUrl(true);
      window.setTimeout(() => setCopiedStoreUrl(false), 2000);
    } catch (caught) {
      console.error("Could not copy vendor store link:", caught);
      setTrackingMessage("Could not copy the store link. Select and copy the link manually.");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <PortalNavigation portal="vendor" />

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

            <section className="mt-8 rounded-2xl border border-green-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-green-700">
                    Your public FIDWEL store
                  </p>
                  <h2 className="mt-2 text-xl font-bold">Share your products and track sales</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                    Anyone with this link can view your approved, available products and shop through the FIDWEL app. Paid purchases of your products made through this link are attributed to your store for sales tracking.
                  </p>
                </div>
                <Link
                  href={canShareStore ? storeUrl : "/vendor-dashboard"}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!canShareStore}
                  onClick={(event) => {
                    if (!canShareStore) event.preventDefault();
                  }}
                  className={`min-h-11 inline-flex items-center rounded-xl border border-green-700 px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-50 ${!canShareStore ? "pointer-events-none opacity-50" : ""}`}
                >
                  View public store
                </Link>
              </div>

              <label className="mt-5 block text-sm font-semibold text-gray-700" htmlFor="vendor-store-link">
                Store link
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  id="vendor-store-link"
                  readOnly
                  value={canShareStore ? storeUrl : "Available after your vendor profile is approved"}
                  onFocus={(event) => event.target.select()}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-700"
                  aria-describedby="vendor-store-tracking-id"
                />
                <button
                  type="button"
                  onClick={() => void copyStoreUrl()}
                  disabled={!canShareStore}
                  className="min-h-11 rounded-xl bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copiedStoreUrl ? "Copied" : "Copy store link"}
                </button>
              </div>

              {salesTracking?.trackingId && (
                <p id="vendor-store-tracking-id" className="mt-3 break-all text-xs text-gray-600">
                  Sales tracking ID: <span className="font-mono font-semibold">{salesTracking.trackingId}</span>
                </p>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-green-50 p-4">
                  <p className="text-sm text-green-900">Paid orders attributed to your store link</p>
                  <p className="mt-1 text-2xl font-bold text-green-900">
                    {salesTracking?.attributedOrders ?? (trackingMessage ? "—" : "0")}
                  </p>
                </div>
                <div className="rounded-xl bg-green-50 p-4">
                  <p className="text-sm text-green-900">Sales from your products via this link</p>
                  <p className="mt-1 text-2xl font-bold text-green-900">
                    {salesTracking
                      ? `₦${salesTracking.attributedSales.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : trackingMessage
                        ? "—"
                        : "₦0.00"}
                  </p>
                </div>
              </div>
              {trackingMessage && (
                <p role="status" className="mt-3 text-sm text-amber-800">{trackingMessage}</p>
              )}
              <p className="mt-3 text-xs leading-5 text-gray-500">
                Only completed, paid purchases of your own products are counted. This is sales attribution, not a commission or payout balance.
              </p>
            </section>

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
