"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useStaffSession } from "@/lib/use-staff-session";
import { formatNaira } from "@/lib/orders";

type Product = {
  id: number;
  name: string;
  price: number;
  unit: string;
  approval_status: string;
  is_available: boolean;
  created_at: string;
  vendor_profiles: { business_name: string } | { business_name: string }[] | null;
};

const FILTERS = ["pending", "approved", "rejected", "all"] as const;
type Filter = (typeof FILTERS)[number];

function vendorName(product: Product): string {
  const vendor = product.vendor_profiles;

  if (Array.isArray(vendor)) {
    return vendor[0]?.business_name ?? "Unknown vendor";
  }

  return vendor?.business_name ?? "Unknown vendor";
}

export default function AdminProductsPage() {
  const session = useStaffSession("admin", "/admin/products");
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loadedFilter, setLoadedFilter] = useState<Filter | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const loading = loadedFilter !== filter;

  useEffect(() => {
    if (!session.authorized) {
      return;
    }

    let active = true;

    (async () => {
      let query = supabase
        .from("products")
        .select("id, name, price, unit, approval_status, is_available, created_at, vendor_profiles(business_name)")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("approval_status", filter);
      }

      const { data, error } = await query;

      if (!active) {
        return;
      }

      if (error) {
        setMessage("We could not load products. Please try again.");
        setLoadedFilter(filter);
        return;
      }

      setProducts((data as unknown as Product[]) ?? []);
      setLoadedFilter(filter);
    })();

    return () => {
      active = false;
    };
  }, [session.authorized, filter]);

  async function moderate(product: Product, action: "approve" | "reject") {
    setBusyId(product.id);
    setMessage("");

    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();

    if (!authSession) {
      return;
    }

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ productId: product.id, action }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { product?: { approval_status: string }; error?: string }
        | null;

      if (!response.ok || !payload?.product) {
        setMessage(payload?.error ?? "Could not update the product.");
        return;
      }

      setProducts((current) =>
        current.map((row) =>
          row.id === product.id
            ? { ...row, approval_status: payload.product!.approval_status }
            : row
        )
      );
      setMessage(`${product.name} updated.`);
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
        <h1 className="text-3xl font-bold">Products</h1>

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
              <p className="mt-8 text-gray-500">Loading products...</p>
            ) : products.length === 0 ? (
              <p className="mt-8 text-gray-500">No products in this view.</p>
            ) : (
              <ul className="mt-6 space-y-4">
                {products.map((product) => (
                  <li
                    key={product.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5 shadow-sm"
                  >
                    <div className="min-w-0">
                      <h2 className="font-bold">{product.name}</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {vendorName(product)} · {formatNaira(product.price)} / {product.unit}
                      </p>
                      <span
                        className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                          product.approval_status === "approved"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : product.approval_status === "pending"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {product.approval_status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {product.approval_status !== "approved" && (
                        <button
                          onClick={() => void moderate(product, "approve")}
                          disabled={busyId === product.id}
                          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
                        >
                          Approve
                        </button>
                      )}
                      {product.approval_status !== "rejected" && (
                        <button
                          onClick={() => void moderate(product, "reject")}
                          disabled={busyId === product.id}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Reject
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
