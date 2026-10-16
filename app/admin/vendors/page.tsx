"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useStaffSession } from "@/lib/use-staff-session";

type Vendor = {
  id: string;
  business_name: string;
  status: string;
  verified: boolean;
  phone: string | null;
  state: string | null;
  lga: string | null;
  town: string | null;
  created_at: string;
};

type Action = "approve" | "reject" | "suspend" | "reactivate";

const FILTERS = ["pending", "active", "suspended", "rejected", "all"] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminVendorsPage() {
  const session = useStaffSession("admin", "/admin/vendors");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loadedFilter, setLoadedFilter] = useState<Filter | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loading = loadedFilter !== filter;

  useEffect(() => {
    if (!session.authorized) {
      return;
    }

    let active = true;

    (async () => {
      let query = supabase
        .from("vendor_profiles")
        .select("id, business_name, status, verified, phone, state, lga, town, created_at")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (!active) {
        return;
      }

      if (error) {
        setMessage("We could not load vendors. Please try again.");
        setLoadedFilter(filter);
        return;
      }

      setVendors((data as Vendor[]) ?? []);
      setLoadedFilter(filter);
    })();

    return () => {
      active = false;
    };
  }, [session.authorized, filter]);

  async function moderate(vendor: Vendor, action: Action) {
    setBusyId(vendor.id);
    setMessage("");

    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();

    if (!authSession) {
      return;
    }

    try {
      const response = await fetch("/api/admin/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ vendorId: vendor.id, action }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { vendor?: { status: string; verified: boolean }; error?: string }
        | null;

      if (!response.ok || !payload?.vendor) {
        setMessage(payload?.error ?? "Could not update the vendor.");
        return;
      }

      setVendors((current) =>
        current.map((row) =>
          row.id === vendor.id
            ? { ...row, status: payload.vendor!.status, verified: payload.vendor!.verified }
            : row
        )
      );
      setMessage(`${vendor.business_name} updated.`);
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/admin" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <Link href="/admin" className="text-sm font-medium hover:text-green-700">
            ← Admin
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">Vendors</h1>

        {session.loading ? (
          <p className="mt-8 text-gray-500">Checking access...</p>
        ) : !session.authorized ? (
          <p className="mt-8 text-gray-500">Admins only.</p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {FILTERS.map((option) => (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium capitalize ${
                    filter === option
                      ? "border-green-700 bg-green-700 text-white"
                      : "border-gray-300 bg-white text-gray-600 hover:border-green-600"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            {message && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                {message}
              </div>
            )}

            {loading ? (
              <p className="mt-8 text-gray-500">Loading vendors...</p>
            ) : vendors.length === 0 ? (
              <p className="mt-8 text-gray-500">No vendors in this view.</p>
            ) : (
              <ul className="mt-6 space-y-4">
                {vendors.map((vendor) => (
                  <li key={vendor.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold">{vendor.business_name}</h2>
                        <p className="mt-1 text-sm text-gray-500">
                          {[vendor.town, vendor.lga, vendor.state].filter(Boolean).join(", ") ||
                            "Location not provided"}
                          {vendor.phone ? ` · ${vendor.phone}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          Registered {new Date(vendor.created_at).toLocaleDateString("en-NG")}
                        </p>
                      </div>
                      <span
                        className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                          vendor.status === "active"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : vendor.status === "pending"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-gray-200 bg-gray-100 text-gray-600"
                        }`}
                      >
                        {vendor.status}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {vendor.status !== "active" && (
                        <button
                          onClick={() => void moderate(vendor, "approve")}
                          disabled={busyId === vendor.id}
                          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
                        >
                          Approve
                        </button>
                      )}
                      {vendor.status === "pending" && (
                        <button
                          onClick={() => void moderate(vendor, "reject")}
                          disabled={busyId === vendor.id}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      )}
                      {vendor.status === "active" && (
                        <button
                          onClick={() => void moderate(vendor, "suspend")}
                          disabled={busyId === vendor.id}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}
