"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/cart";

type ProductRow = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  quantity_available: number;
  image_url: string | null;
  category_id: number | null;
  vendor_id: string;
};

type VendorRow = {
  id: string;
  business_name: string;
  state: string | null;
  lga: string | null;
  town: string | null;
  verified: boolean;
  status: string;
};

type CategoryRow = { id: number; name: string };

type MarketplaceProduct = ProductRow & {
  vendor: VendorRow | null;
  categoryName: string;
};

const FALLBACK_IMAGE = "/images/plantain.jpg";

function formatPrice(price: number): string {
  return `₦${Number(price).toLocaleString("en-NG")}`;
}

export default function ProductsPage() {
  const { addItem, count } = useCart();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadMarketplace() {
      setLoading(true);
      setError("");

      const [categoryResult, productResult] = await Promise.all([
        supabase.from("categories").select("id, name").order("name"),
        supabase
          .from("products")
          .select("id, name, description, price, unit, quantity_available, image_url, category_id, vendor_id")
          .eq("approval_status", "approved")
          .eq("is_available", true)
          .gt("quantity_available", 0)
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;

      if (categoryResult.error) {
        setError("We couldn't load product categories. Please refresh the page.");
        setLoading(false);
        return;
      }

      if (productResult.error) {
        console.error("Marketplace product query failed:", productResult.error.message);
        setError("We couldn't load products from the marketplace. Please refresh and try again.");
        setLoading(false);
        return;
      }

      const categoryRows = (categoryResult.data ?? []) as CategoryRow[];
      const productRows = (productResult.data ?? []) as ProductRow[];
      const vendorIds = [...new Set(productRows.map((product) => product.vendor_id))];

      let vendors: VendorRow[] = [];
      if (vendorIds.length > 0) {
        const vendorResult = await supabase
          .from("vendor_profiles")
          .select("id, business_name, state, lga, town, verified, status")
          .in("id", vendorIds)
          .eq("status", "active")
          .eq("verified", true);

        if (vendorResult.error) {
          console.error("Marketplace vendor query failed:", vendorResult.error.message);
          setError("We couldn't verify product sellers. Please refresh and try again.");
          setLoading(false);
          return;
        }
        vendors = (vendorResult.data ?? []) as VendorRow[];
      }

      const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
      const categoryById = new Map(categoryRows.map((category) => [category.id, category.name]));

      const visibleProducts = productRows
        .filter((product) => vendorById.has(product.vendor_id))
        .map((product) => ({
          ...product,
          vendor: vendorById.get(product.vendor_id) ?? null,
          categoryName: product.category_id ? categoryById.get(product.category_id) ?? "Other" : "Other",
        }));

      setCategories(categoryRows);
      setProducts(visibleProducts);
      setLoading(false);
    }

    void loadMarketplace();
    return () => {
      active = false;
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = products.filter((product) => {
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.categoryName.toLowerCase().includes(term) ||
        (product.vendor?.business_name ?? "").toLowerCase().includes(term) ||
        [product.vendor?.town, product.vendor?.lga, product.vendor?.state]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesCategory = !categoryId || String(product.category_id) === categoryId;
      const matchesVerified = !verifiedOnly || product.vendor?.verified === true;
      return matchesSearch && matchesCategory && matchesVerified;
    });

    if (sort === "price-low") result.sort((a, b) => a.price - b.price);
    else if (sort === "price-high") result.sort((a, b) => b.price - a.price);
    else result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [products, search, categoryId, verifiedOnly, sort]);

  return (
    <main className="min-h-screen w-full bg-gray-50 font-sans text-gray-900">
      <nav className="border-b border-green-100 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-green-800">FIDWEL</Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/orders" className="hidden hover:text-green-700 sm:block">My Orders</Link>
            <Link href="/cart" className="rounded-lg bg-green-700 px-3 py-2 text-white hover:bg-green-800">
              Cart{count > 0 ? ` (${count})` : ""}
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">Fresh food. Local farmers. Better living.</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Agricultural Marketplace</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600 sm:text-base">
          Discover available products from active, verified FIDWEL vendors.
        </p>

        <div className="mt-6 grid gap-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products, vendors or locations"
            aria-label="Search products, vendors or locations"
            className="min-w-0 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 sm:col-span-2"
          />
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label="Filter by category"
            className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-green-600"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Sort products"
            className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-green-600"
          >
            <option value="name">Sort: Product name</option>
            <option value="price-low">Price: Low to high</option>
            <option value="price-high">Price: High to low</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 lg:col-span-4">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(event) => setVerifiedOnly(event.target.checked)}
              className="h-4 w-4 accent-green-700"
            />
            Show verified vendors only
          </label>
        </div>

        {loading ? (
          <div className="mt-8 rounded-2xl border bg-white p-10 text-center text-gray-600">Loading products from FIDWEL…</div>
        ) : error ? (
          <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            {error}
            <button type="button" onClick={() => window.location.reload()} className="ml-3 font-semibold underline">Refresh</button>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="mt-8 rounded-2xl border bg-white p-10 text-center shadow-sm">
            <div className="text-5xl" aria-hidden="true">🌾</div>
            <h2 className="mt-4 text-xl font-bold">No products found</h2>
            <p className="mt-2 text-sm text-gray-600">
              Try another search or category. Approved, available products appear here when vendors have stock.
            </p>
            {(search || categoryId || verifiedOnly) && (
              <button
                type="button"
                onClick={() => { setSearch(""); setCategoryId(""); setVerifiedOnly(false); }}
                className="mt-4 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-600">{visibleProducts.length} product{visibleProducts.length === 1 ? "" : "s"} available</p>
              <span className="text-xs text-green-800">Verified sellers</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProducts.map((product) => (
                <article key={product.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <Link href={`/products/${product.id}`} className="block">
                    <img
                      src={product.image_url || FALLBACK_IMAGE}
                      alt={product.name}
                      className="h-48 w-full bg-green-50 object-cover"
                      onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}
                    />
                  </Link>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-green-700">{product.categoryName}</p>
                        <Link href={`/products/${product.id}`} className="mt-1 block font-bold hover:text-green-700">{product.name}</Link>
                      </div>
                      <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-800">✓ Verified</span>
                    </div>
                    <p className="mt-2 text-xl font-extrabold text-green-800">
                      {formatPrice(product.price)} <span className="text-xs font-normal text-gray-500">/ {product.unit}</span>
                    </p>
                    <p className="mt-2 text-sm text-gray-600">{product.vendor?.business_name ?? "Verified FIDWEL vendor"}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {[product.vendor?.town, product.vendor?.lga, product.vendor?.state].filter(Boolean).join(", ") || "Location not provided"}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">Available: {product.quantity_available} {product.unit}</p>
                    <div className="mt-4 flex gap-2">
                      <Link href={`/products/${product.id}`} className="flex-1 rounded-xl border border-green-700 px-3 py-2.5 text-center text-sm font-semibold text-green-800 hover:bg-green-50">View details</Link>
                      <button
                        type="button"
                        onClick={() => addItem({
                          id: product.id,
                          name: product.name,
                          price: Number(product.price),
                          unit: product.unit,
                          image_url: product.image_url || FALLBACK_IMAGE,
                        })}
                        className="flex-1 rounded-xl bg-green-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-green-800"
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
