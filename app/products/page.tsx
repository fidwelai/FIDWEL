"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Product = {
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

type Category = {
  id: number;
  name: string;
};

function normalizeUnit(name: string, unit: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("plantain") || lower.includes("cassava")) {
    return "kg";
  }
  return unit;
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState("name");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");

      setCategories(data ?? []);
    }

    loadCategories();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setError("");

      let query = supabase
        .from("products")
        .select(
          "id, name, description, price, unit, quantity_available, image_url, category_id, vendor_id"
        )
        .eq("is_available", true)
        .eq("approval_status", "approved")
        .gt("quantity_available", 0);

      const term = debouncedSearch.trim().replace(/[%,()]/g, " ");
      if (term) {
        query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
      }

      if (categoryId) {
        query = query.eq("category_id", Number(categoryId));
      }

      const min = Number(minPrice);
      if (minPrice.trim() && Number.isFinite(min)) {
        query = query.gte("price", min);
      }

      const max = Number(maxPrice);
      if (maxPrice.trim() && Number.isFinite(max)) {
        query = query.lte("price", max);
      }

      switch (sort) {
        case "price-asc":
          query = query.order("price", { ascending: true });
          break;
        case "price-desc":
          query = query.order("price", { ascending: false });
          break;
        case "newest":
          query = query.order("created_at", { ascending: false });
          break;
        default:
          query = query.order("name", { ascending: true });
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        setError("We couldn't load products. Please try again.");
        setProducts([]);
      } else {
        const normalized = ((data ?? []) as Product[]).map((p) => ({
          ...p,
          unit: normalizeUnit(p.name, p.unit),
        }));
        setProducts(normalized);
      }

      setLoading(false);
    }

    loadProducts();
  }, [debouncedSearch, categoryId, sort, minPrice, maxPrice]);

  const hasFilters =
    search.trim() !== "" ||
    categoryId !== "" ||
    sort !== "name" ||
    minPrice.trim() !== "" ||
    maxPrice.trim() !== "";

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setCategoryId("");
    setSort("name");
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <>
      <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or description..."
            className="rounded-xl border px-4 py-3 outline-none focus:border-green-600 lg:col-span-2"
          />

          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded-xl border bg-white px-4 py-3 outline-none focus:border-green-600"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="rounded-xl border bg-white px-4 py-3 outline-none focus:border-green-600"
          >
            <option value="name">Sort: Name (A–Z)</option>
            <option value="price-asc">Sort: Price (low to high)</option>
            <option value="price-desc">Sort: Price (high to low)</option>
            <option value="newest">Sort: Newest first</option>
          </select>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <input
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Min price (₦)"
            className="rounded-xl border px-4 py-3 outline-none focus:border-green-600"
          />

          <input
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Max price (₦)"
            className="rounded-xl border px-4 py-3 outline-none focus:border-green-600"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">
              {loading ? "Searching..." : `${products.length} result${products.length === 1 ? "" : "s"}`}
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <p className="mt-8 text-gray-600">Loading products...</p>
      )}

      {error && (
        <p className="mt-8 rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">🌾</div>
          <h2 className="mt-4 text-xl font-bold">
            {hasFilters ? "No products match your filters" : "No products found yet"}
          </h2>
          <p className="mt-2 text-gray-600">
            {hasFilters
              ? "Try a different search term or clear the filters."
              : "Products will appear here when vendors add available listings."}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <article
              key={product.id}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
            >
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center bg-green-50 text-6xl">
                  🌱
                </div>
              )}

              <div className="p-5">
                <h2 className="text-lg font-bold">{product.name}</h2>

                <p className="mt-2 text-xl font-bold text-green-700">
                  ₦{Number(product.price).toLocaleString("en-NG")}
                  <span className="ml-1 text-sm font-normal text-gray-500">
                    / {product.unit}
                  </span>
                </p>

                <p className="mt-2 text-sm text-gray-600">
                  {product.description || "Contact the vendor for details."}
                </p>

                <p className="mt-3 text-sm text-gray-500">
                  Available: {product.quantity_available} {product.unit}
                </p>

                <Link
                  href={`/products/${product.id}`}
                  className="mt-5 block w-full rounded-xl bg-green-700 px-4 py-3 text-center font-semibold text-white hover:bg-green-800"
                >
                  View details
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/" className="text-sm font-medium hover:text-green-700">
              ← Back to Home
            </Link>
            <Link
              href="/cart"
              className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
            >
              Cart
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-bold">Agricultural Marketplace</h1>
        <p className="mt-2 text-gray-600">
          Discover available agricultural products from our vendors.
        </p>

        <Suspense
          fallback={
            <div className="mt-8">
              <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-2 lg:grid-cols-4">
                <div className="h-12 rounded-xl bg-gray-100 animate-pulse lg:col-span-2" />
                <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
              </div>
              <p className="mt-8 text-gray-600">Loading products...</p>
            </div>
          }
        >
          <ProductsContent />
        </Suspense>
      </section>
    </main>
  );
}
