"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  quantity_available: number;
  image_url: string | null;
  is_available: boolean;
  approval_status?: string;
};

type Vendor = {
  id: string;
  user_id: string;
  status: string;
  verified: boolean;
};

function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(value || 0);
}

export default function VendorProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const getCurrentVendor = useCallback(async (): Promise<Vendor> => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);
    if (!data.user) {
      router.push("/login");
      throw new Error("Not logged in");
    }
    const res = await supabase
     .from("vendor_profiles")
     .select("id, user_id, status, verified")
     .eq("user_id", data.user.id)
     .maybeSingle();

    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error("Vendor profile not found");
    return res.data as Vendor;
  }, [router]);

  const loadProducts = useCallback(async () => {
    try {
      const vendor = await getCurrentVendor();
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, unit, quantity_available, image_url, is_available, approval_status")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts((data as Product[]) || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [getCurrentVendor]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const vendor = await getCurrentVendor();
        const { data, error } = await supabase
          .from("products")
          .select("id, name, description, price, unit, quantity_available, image_url, is_available, approval_status")
          .eq("vendor_id", vendor.id)
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (error) throw error;
        setProducts((data as Product[]) || []);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getCurrentVendor]);

  async function toggleAvailability(product: Product) {
    setError("");
    setSuccess("");
    setBusyId(product.id);
    try {
      const vendor = await getCurrentVendor();
      const newVal =!product.is_available;
      const { data, error } = await supabase
       .from("products")
       .update({ is_available: newVal })
       .eq("id", product.id)
       .eq("vendor_id", vendor.id)
       .select("id")
       .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Update failed - check RLS policy");
      setProducts((c) => c.map((p) => (p.id === product.id? {...p, is_available: newVal } : p)));
      setSuccess(product.name + " is now " + (newVal? "available" : "unavailable"));
    } catch (err) {
      const msg = err instanceof Error? err.message : "Update failed";
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProduct(product: Product) {
    if (!confirm("Delete " + product.name + "?")) return;
    setError("");
    setSuccess("");
    setBusyId(product.id);
    try {
      const vendor = await getCurrentVendor();
      const { data, error } = await supabase
       .from("products")
       .delete()
       .eq("id", product.id)
       .eq("vendor_id", vendor.id)
       .select("id")
       .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Delete failed - check RLS policy");
      setProducts((c) => c.filter((p) => p.id!== product.id));
      setSuccess(product.name + " deleted");
    } catch (err) {
      const msg = err instanceof Error? err.message : "Delete failed";
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
  });

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold">My Products</h1>
      {error && <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mt-4 rounded bg-green-50 p-3 text-sm text-green-700">{success}</div>}
      <div className="mt-4 flex gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full rounded border px-4 py-2" />
        <button onClick={() => void loadProducts()} className="rounded border bg-white px-4 py-2">Refresh</button>
      </div>
      <div className="mt-6">
        {loading? <p>Loading...</p> : filtered.map((product) => (
          <div key={product.id} className="mb-3 flex gap-4 rounded border bg-white p-4">
            <div className="h-20 w-20 bg-gray-100 rounded overflow-hidden">
              {product.image_url? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <span className="text-xs p-2">No image</span>}
            </div>
            <div className="flex-1">
              <h3 className="font-bold">{product.name}</h3>
              <p className="text-sm">{formatNaira(product.price)} / {product.unit}</p>
              <p className="text-xs text-gray-500">Stock: {product.quantity_available}</p>
              <p className="text-xs text-gray-500 capitalize">Review status: {product.approval_status ?? "approved"}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href={`/vendor/products/${product.id}/edit`} className="rounded border border-gray-300 px-3 py-1 text-center text-sm text-gray-700">Edit</Link>
              <button onClick={() => void toggleAvailability(product)} disabled={busyId === product.id} className="rounded border border-green-700 px-3 py-1 text-sm text-green-700 disabled:opacity-50">{product.is_available? "Mark unavailable" : "Mark available"}</button>
              <button onClick={() => void deleteProduct(product)} disabled={busyId === product.id} className="rounded border border-red-200 px-3 py-1 text-sm text-red-700 disabled:opacity-50">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
