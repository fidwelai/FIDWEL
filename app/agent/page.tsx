"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useStaffSession } from "@/lib/use-staff-session";

type ReferredVendor = {
  id: string;
  business_name: string;
  status: string;
  verified: boolean;
  state: string | null;
  town: string | null;
  created_at: string;
};

function statusTone(status: string): string {
  if (status === "active") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-gray-200 bg-gray-100 text-gray-600";
}

export default function AgentPortalPage() {
  const session = useStaffSession("agent", "/agent");
  const [origin, setOrigin] = useState("");
  const [vendors, setVendors] = useState<ReferredVendor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  const loading = session.authorized && !loaded;

  useEffect(() => {
    if (!session.authorized || !session.userId) {
      return;
    }

    let active = true;

    (async () => {
      const pageOrigin = window.location.origin;

      const { data } = await supabase
        .from("vendor_profiles")
        .select("id, business_name, status, verified, state, town, created_at")
        .eq("agent_id", session.userId)
        .order("created_at", { ascending: false });

      if (!active) {
        return;
      }

      setOrigin(pageOrigin);
      setVendors((data as ReferredVendor[]) ?? []);
      setLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, [session.authorized, session.userId]);

  const referralLink =
    origin && session.userId ? `${origin}/vendor/register?ref=${session.userId}` : "";

  async function copyLink() {
    if (!referralLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const pending = vendors.filter((vendor) => vendor.status === "pending").length;
  const active = vendors.filter((vendor) => vendor.status === "active").length;

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <span className="text-sm text-gray-500">Agent portal</span>
        </div>
      </nav>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-bold">Grow the marketplace</h1>
        <p className="mt-2 text-gray-600">
          Share your referral link. Vendors who register through it are attributed to you.
        </p>

        {session.loading ? (
          <p className="mt-8 text-gray-500">Checking access...</p>
        ) : !session.authorized ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold">Agents only</h2>
            <p className="mt-2 text-gray-600">
              Your account is not set up as an agent.
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
            <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Your referral link</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  readOnly
                  value={referralLink}
                  onFocus={(event) => event.target.select()}
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700"
                />
                <button
                  onClick={() => void copyLink()}
                  className="shrink-0 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Referred vendors</p>
                <p className="mt-2 text-3xl font-bold">{vendors.length}</p>
              </div>
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Pending</p>
                <p className="mt-2 text-3xl font-bold text-amber-600">{pending}</p>
              </div>
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Active</p>
                <p className="mt-2 text-3xl font-bold text-green-700">{active}</p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">Vendors you referred</h2>

              {loading ? (
                <p className="mt-4 text-gray-500">Loading...</p>
              ) : vendors.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">
                  No one has registered through your link yet.
                </p>
              ) : (
                <ul className="mt-4 divide-y">
                  {vendors.map((vendor) => (
                    <li
                      key={vendor.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="font-semibold">{vendor.business_name}</p>
                        <p className="text-sm text-gray-500">
                          {[vendor.town, vendor.state].filter(Boolean).join(", ") ||
                            "Location not provided"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusTone(
                          vendor.status
                        )}`}
                      >
                        {vendor.status}
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
