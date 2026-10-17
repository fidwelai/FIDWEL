"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/cart";

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

type Rating = {
  product_id: number;
  average_rating: number | null;
  review_count: number;
};

type Category = { id: number; name: string };

function naira(value: number) {
  return "₦" + Number(value || 0).toLocaleString("en-NG");
}

export default function ProductsPage() {
  const { addItem, count } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [categoryNames, setCategoryNames] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addedId, setAddedId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMarketplace() {
      setLoading(true);
      setError("");

      const [{ data: rows, error: productsError }, { data: categoryRows }] =
        await Promise.all([
          supabase
            .from("products")
            .select("id, name, description, price, unit, quantity_available, image_url, category_id, vendor_id")
            .eq("approval_status", "approved")
            .eq("is_available", true)
            .gt("quantity_available", 0)
            .order("created_at", { ascending: false }),
          supabase.from("categories").select("id, name").order("name"),
        ]);

      if (!active) return;

      if (productsError) {
        setError("We couldn't load marketplace listings. Please refresh and try again.");
        setProducts([]);
        setLoading(false);
        return;
      }

      const liveProducts = (rows ?? []) as Product[];
      setProducts(liveProducts);
      const categoryList = (categoryRows ?? []) as Category[];
      setCategories(categoryList);
      setCategoryNames(Object.fromEntries(categoryList.map((category) => [category.id, category.name])));

      if (liveProducts.length > 0) {
        const ids = liveProducts.map((product) => product.id);
        const { data: ratingRows } = await supabase
          .from("product_ratings")
          .select("product_id, average_rating, review_count")
          .in("product_id", ids);

        if (active) {
          const lookup: Record<number, Rating> = {};
          ((ratingRows ?? []) as Rating[]).forEach((rating) => {
            lookup[Number(rating.product_id)] = rating;
          });
          setRatings(lookup);
        }
      } else {
        setRatings({});
      }

      if (active) setLoading(false);
    }

    void loadMarketplace();
    return () => {
      active = false;
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        (product.description ?? "").toLowerCase().includes(term) ||
        (categoryNames[product.category_id ?? -1] ?? "").toLowerCase().includes(term);
      const matchesCategory =
        selectedCategory === "all" ||
        String(product.category_id ?? "") === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory, categoryNames]);

  function addToCart(product: Product) {
    addItem({
      id: Number(product.id),
      name: product.name,
      price: Number(product.price),
      unit: product.unit,
      image_url: product.image_url || "/images/plantain.jpg",
    });
    setAddedId(Number(product.id));
    window.setTimeout(() => setAddedId((current) => current === Number(product.id) ? null : current), 1800);
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28 font-sans">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-green-700">FIDWEL</Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/orders" className="hidden text-gray-600 hover:text-green-700 sm:inline">My Orders</Link>
            <Link href="/cart" className="rounded-full bg-green-700 px-4 py-2 text-white hover:bg-green-800">
              Cart{count > 0 ? ` (${count})` : ""}
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-green-700">From local vendors</p>
            <h1 className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">Fresh produce marketplace</h1>
            <p className="mt-2 max-w-2xl text-gray-600">Discover agricultural products from approved, verified FIDWEL vendors.</p>
          </div>
          <label className="w-full md:max-w-sm">
            <span className="sr-only">Search products</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plantain, fish, yam..."
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </label>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          <button onClick={() => setSelectedCategory("all")} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${selectedCategory === "all" ? "bg-green-700 text-white" : "border bg-white text-gray-600 hover:border-green-600"}`}>All products</button>
          {categories.map((category) => (
            <button key={category.id} onClick={() => setSelectedCategory(String(category.id))} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${selectedCategory === String(category.id) ? "bg-green-700 text-white" : "border bg-white text-gray-600 hover:border-green-600"}`}>
              {category.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-gray-200" />)}
          </div>
        ) : error ? (
          <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-white p-6 text-red-700">
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-green-700 px-4 py-2 font-semibold text-white">Try again</button>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="mt-8 rounded-2xl border bg-white px-6 py-14 text-center">
            <div className="text-5xl">🌾</div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">{products.length === 0 ? "No approved products yet" : "No matching products"}</h2>
            <p className="mt-2 text-gray-600">{products.length === 0 ? "Approved listings from active, verified vendors will appear here." : "Try another search or choose a different category."}</p>
            {products.length > 0 && <button onClick={() => { setSearch(""); setSelectedCategory("all"); }} className="mt-4 font-semibold text-green-700 underline">Clear filters</button>}
          </div>
        ) : (
          <>
            <p className="mt-5 text-sm text-gray-500">{visibleProducts.length} product{visibleProducts.length === 1 ? "" : "s"} available</p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product) => {
                const rating = ratings[Number(product.id)];
                return (
                  <article key={product.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <Link href={`/products/${product.id}`} className="block">
                      <div className="relative h-48 bg-green-50">
                        {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-6xl">🌱</div>}
                        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-green-800">Verified marketplace</span>
                      </div>
                      <div className="p-4 pb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">{product.category_id ? categoryNames[product.category_id] ?? "Farm produce" : "Farm produce"}</p>
                        <h2 className="mt-1 line-clamp-2 min-h-12 text-base font-bold text-gray-900">{product.name}</h2>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          {rating && Number(rating.review_count) > 0 ? <><span className="font-bold text-amber-600">★ {Number(rating.average_rating).toFixed(1)}</span><span className="text-gray-500">({rating.review_count} reviews)</span></> : <span className="text-gray-500">No reviews yet</span>}
                        </div>
                        <p className="mt-3 text-lg font-extrabold text-gray-900">{naira(Number(product.price))}<span className="ml-1 text-sm font-normal text-gray-500">/ {product.unit}</span></p>
                        <p className="mt-1 text-xs text-gray-500">In stock: {Number(product.quantity_available).toLocaleString("en-NG")} {product.unit}</p>
                      </div>
                    </Link>
                    <div className="px-4 pb-4 pt-2">
                      <button onClick={() => addToCart(product)} className="w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-800">
                        {addedId === Number(product.id) ? "✓ Added — keep shopping" : "Add to Cart"}
                      </button>
                      <Link href={`/products/${product.id}`} className="mt-2 block text-center text-sm font-semibold text-green-700 hover:underline">View product details</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-xl items-center justify-around px-3 py-3 text-xs font-medium text-gray-500">
          <Link href="/" className="flex flex-col items-center gap-1 hover:text-green-700"><span className="text-lg">⌂</span>Home</Link>
          <Link href="/products" aria-current="page" className="flex flex-col items-center gap-1 text-green-700"><span className="text-lg">⌕</span>Products</Link>
          <Link href="/cart" className="relative flex flex-col items-center gap-1 hover:text-green-700"><span className="text-lg">🛒</span>Cart{count > 0 ? ` (${count})` : ""}</Link>
          <Link href="/orders" className="flex flex-col items-center gap-1 hover:text-green-700"><span className="text-lg">▤</span>Orders</Link>
          <Link href="/login" className="flex flex-col items-center gap-1 hover:text-green-700"><span className="text-lg">♙</span>Account</Link>
        </div>
      </nav>
    </main>
  );
}
