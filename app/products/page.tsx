"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
  created_at?: string | null;
};

type Category = {
  id: number;
  name: string;
};

type MockProduct = {
  id: string;
  name: string;
  vendor: string;
  price: number;
  category: string;
  image: string;
  description: string;
};

type DisplayProduct = {
  id: number | string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  quantity_available: number | null;
  image_url: string | null;
  category: string | null;
  created_at: string | null;
};

function normalizeUnit(name: string, unit: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("plantain") || lower.includes("cassava")) {
    return "kg";
  }
  return unit;
}

const MOCK_PRODUCTS: MockProduct[] = [
  { id: "1", name: "Fresh Plantain Bunch", vendor: "Mama Gold Farm", price: 2500, category: "Plantain", image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400", description: "Fresh plantain bunch" },
  { id: "2", name: "Catfish (Live)", vendor: "Fish Hub", price: 3500, category: "Fish", image: "https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?w=400", description: "Live catfish" },
  { id: "3", name: "White Yam Tubers", vendor: "Yam Barn", price: 1800, category: "Yam", image: "https://images.unsplash.com/photo-1596097156937-968d8e95c8e6?w=400", description: "White yam" },
  { id: "4", name: "Fresh Cassava", vendor: "Root Farms", price: 1200, category: "Cassava", image: "https://images.unsplash.com/photo-1543528173-d4dccdbf2e8c?w=400", description: "Fresh cassava" },
  { id: "5", name: "Ugwu Leaves", vendor: "Green Farms", price: 500, category: "Vegetables", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400", description: "Ugwu leaves" },
  { id: "6", name: "Palm Oil 5L", vendor: "Oil Mill", price: 8000, category: "More", image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400", description: "Palm oil" }
];

const MOCK_DISPLAY: DisplayProduct[] = MOCK_PRODUCTS.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  price: p.price,
  unit: normalizeUnit(p.name, ""),
  quantity_available: null,
  image_url: p.image,
  category: p.category,
  created_at: null,
}));

function ProductsContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [fetchedProducts, setFetchedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [categoryName, setCategoryName] = useState("");
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

      const { data, error: queryError } = await supabase
        .from("products")
        .select(
          "id, name, description, price, unit, quantity_available, image_url, category_id, vendor_id, created_at"
        )
        .eq("is_available", true)
        .eq("approval_status", "approved")
        .gt("quantity_available", 0);

      if (queryError) {
        setError("We couldn't load products. Please try again.");
        setFetchedProducts([]);
      } else {
        setFetchedProducts((data ?? []) as Product[]);
      }

      setLoading(false);
    }

    loadProducts();
  }, []);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((category) => map.set(category.id, category.name));
    return map;
  }, [categories]);

  const fetchedDisplay: DisplayProduct[] = useMemo(
    () =>
      fetchedProducts.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        unit: normalizeUnit(product.name, product.unit),
        quantity_available: product.quantity_available,
        image_url: product.image_url,
        category:
          product.category_id != null
            ? categoryNameById.get(product.category_id) ?? null
            : null,
        created_at: product.created_at ?? null,
      })),
    [fetchedProducts, categoryNameById]
  );

  const displayProducts =
    fetchedDisplay.length > 0 ? fetchedDisplay : MOCK_DISPLAY;

  const categoryOptions = useMemo(() => {
    const names = new Set<string>();
    categories.forEach((category) => names.add(category.name));
    MOCK_PRODUCTS.forEach((product) => names.add(product.category));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const visibleProducts = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const min = Number(minPrice);
    const max = Number(maxPrice);

    const filtered = displayProducts.filter((product) => {
      if (term) {
        const haystack = `${product.name} ${product.description ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }

      if (categoryName && (product.category ?? "") !== categoryName) {
        return false;
      }

      if (minPrice.trim() && Number.isFinite(min) && product.price < min) {
        return false;
      }

      if (maxPrice.trim() && Number.isFinite(max) && product.price > max) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "newest":
          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [displayProducts, debouncedSearch, categoryName, sort, minPrice, maxPrice]);

  const hasFilters =
    search.trim() !== "" ||
    categoryName !== "" ||
    sort !== "name" ||
    minPrice.trim() !== "" ||
    maxPrice.trim() !== "";

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setCategoryName("");
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
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            className="rounded-xl border bg-white px-4 py-3 outline-none focus:border-green-600"
          >
            <option value="">All categories</option>
            {categoryOptions.map((name) => (
              <option key={name} value={name}>
                {name}
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
              {loading
                ? "Searching..."
                : `${visibleProducts.length} result${visibleProducts.length === 1 ? "" : "s"}`}
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

      {!loading && !error && visibleProducts.length === 0 && (
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

      {!loading && !error && visibleProducts.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((product) => (
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
                  {product.unit ? (
                    <span className="ml-1 text-sm font-normal text-gray-500">
                      / {product.unit}
                    </span>
                  ) : null}
                </p>

                <p className="mt-2 text-sm text-gray-600">
                  {product.description || "Contact the vendor for details."}
                </p>

                {product.quantity_available != null && (
                  <p className="mt-3 text-sm text-gray-500">
                    Available: {product.quantity_available} {product.unit}
                  </p>
                )}

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
