"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

type Vendor = {
  id: string;
  business_name: string;
  state: string | null;
  lga: string | null;
  town: string | null;
  verified: boolean;
  status: string;
};

function normalizeUnit(name: string, unit: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("plantain") || lower.includes("cassava")) return "kg";
  return unit;
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id;
  const { addItem, count } = useCart();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      const numericId = Number(productId);
      if (!productId || !Number.isSafeInteger(numericId) || numericId <= 0) {
        setError("This product link is invalid.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
        .from("products")
        .select("id, name, description, price, unit, quantity_available, image_url, category_id, vendor_id")
        .eq("id", numericId)
        .eq("is_available", true)
        .eq("approval_status", "approved")
        .gt("quantity_available", 0)
        .maybeSingle();

      if (!active) return;

      if (queryError) {
        console.error("Product detail query failed:", queryError.message, queryError.code);
        setError("We couldn't load this product right now. Please try again.");
        setProduct(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setError("This product is unavailable, out of stock, or no longer listed.");
        setProduct(null);
        setLoading(false);
        return;
      }

      const row = data as Product;
      setProduct({ ...row, unit: normalizeUnit(row.name, row.unit) });
      setQuantity(1);

      const [categoryResult, vendorResult] = await Promise.all([
        row.category_id
          ? supabase.from("categories").select("name").eq("id", row.category_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("vendor_profiles")
          .select("id, business_name, state, lga, town, verified, status")
          .eq("id", row.vendor_id)
          .eq("status", "active")
          .eq("verified", true)
          .maybeSingle(),
      ]);

      if (!active) return;

      setCategoryName(categoryResult.data?.name ?? null);
      if (vendorResult.error) {
        console.error("Product vendor lookup failed:", vendorResult.error.message);
      }
      setVendor((vendorResult.data as Vendor | null) ?? null);
      setLoading(false);
    }

    void loadProduct();
    return () => {
      active = false;
    };
  }, [productId]);

  async function handleShare() {
    if (!product || typeof window === "undefined") return;
    setShareMessage("");
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareMessage("Product link copied.");
      } else {
        setShareMessage("Sharing is not supported in this browser.");
      }
    } catch {
      setShareMessage("Sharing was cancelled or unavailable.");
    }
  }

  function addCurrentToCart() {
    if (!product) return;
    const safeQuantity = Math.max(1, Math.min(quantity, Math.floor(product.quantity_available)));
    addItem({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      unit: product.unit,
      image_url: product.image_url || "/images/plantain.jpg",
    }, safeQuantity);
    setAdded(true);
  }

  function handleBuyNow() {
    if (!product) return;
    addCurrentToCart();
    router.push("/checkout");
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="border-b border-green-100 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link href="/" className="text-2xl font-extrabold text-green-800">FIDWEL</Link>
          <div className="flex items-center gap-3">
            <Link href="/products" className="text-sm font-medium hover:text-green-700">← Products</Link>
            <button type="button" onClick={handleShare} className="text-sm font-medium text-gray-600 hover:text-green-700">Share</button>
            <Link href="/cart" className="rounded-xl bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800">Cart{count > 0 ? ` (${count})` : ""}</Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-gray-600">Loading product details…</div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border bg-white p-10 text-center shadow-sm">
            <div className="text-5xl" aria-hidden="true">🌾</div>
            <h1 className="mt-4 text-xl font-bold">{error}</h1>
            <Link href="/products" className="mt-6 inline-block rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800">Browse available products</Link>
          </div>
        ) : product ? (
          <>
            <div className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm md:grid md:grid-cols-2">
              <div className="min-h-64 bg-green-50">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-72 w-full object-cover md:h-full md:min-h-[440px]" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                ) : (
                  <div className="flex h-72 items-center justify-center text-7xl md:h-full">🌱</div>
                )}
              </div>

              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  {categoryName ? <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">{categoryName}</span> : <span className="text-xs text-gray-500">Fresh agricultural produce</span>}
                  <button type="button" onClick={() => setFavorite((value) => !value)} aria-pressed={favorite} aria-label={favorite ? "Remove from favourites" : "Add to favourites"} className={`text-2xl ${favorite ? "text-red-500" : "text-gray-300 hover:text-red-500"}`}>♥</button>
                </div>

                <h1 className="mt-4 text-3xl font-extrabold">{product.name}</h1>
                <p className="mt-3 text-3xl font-extrabold text-green-800">
                  ₦{Number(product.price).toLocaleString("en-NG")}
                  <span className="ml-1 text-base font-normal text-gray-500">/ {product.unit}</span>
                </p>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-600">{product.description || "Contact the vendor for more information about this product."}</p>

                <div className="mt-5 rounded-2xl bg-green-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">Seller information</p>
                  {vendor ? (
                    <>
                      <p className="mt-2 font-bold text-green-900">{vendor.business_name}</p>
                      <p className="mt-1 text-sm text-gray-600">{[vendor.town, vendor.lga, vendor.state].filter(Boolean).join(", ") || "Location not provided"}</p>
                      <p className="mt-2 text-xs font-semibold text-green-800">✓ Verified FIDWEL seller</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-gray-600">Verified seller details are temporarily unavailable.</p>
                  )}
                </div>

                <p className="mt-4 text-sm text-gray-600">In stock: {product.quantity_available} {product.unit}</p>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <div className="flex items-center rounded-xl border border-gray-200">
                    <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="px-4 py-3 text-lg font-bold" aria-label="Decrease quantity">−</button>
                    <span className="min-w-10 text-center font-bold">{quantity}</span>
                    <button type="button" onClick={() => setQuantity((value) => Math.min(Math.floor(product.quantity_available), value + 1))} disabled={quantity >= Math.floor(product.quantity_available)} className="px-4 py-3 text-lg font-bold disabled:opacity-40" aria-label="Increase quantity">+</button>
                  </div>
                  <span className="font-bold">Total: ₦{(Number(product.price) * quantity).toLocaleString("en-NG")}</span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={addCurrentToCart} className="rounded-xl bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800">Add to Cart</button>
                  <button type="button" onClick={handleBuyNow} className="rounded-xl border border-green-700 px-4 py-3 font-semibold text-green-800 hover:bg-green-50">Buy Now</button>
                </div>

                {added && <div role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-900">Added to your cart. <Link href="/cart" className="font-bold underline">View cart</Link></div>}
                {shareMessage && <p role="status" className="mt-3 text-sm text-gray-600">{shareMessage}</p>}
                <p className="mt-4 text-xs text-gray-500">You'll sign in at checkout before placing an order.</p>
              </div>
            </div>

            <ProductReviews productId={product.id} />
          </>
        ) : null}
      </section>
    </main>
  );
}

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type RatingSummary = {
  review_count: number;
  average_rating: number | null;
};

function StarRow({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span className="text-lg tracking-tight" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= rounded ? "text-amber-500" : "text-gray-300"}>★</span>)}
    </span>
  );
}

function ProductReviews({ productId }: { productId: number }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [eligibleItemId, setEligibleItemId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const [{ data: reviewRows }, { data: summaryRow }, { data: userData }] = await Promise.all([
        supabase.from("reviews").select("id, rating, comment, created_at").eq("product_id", productId).order("created_at", { ascending: false }),
        supabase.from("product_ratings").select("review_count, average_rating").eq("product_id", productId).maybeSingle(),
        supabase.auth.getUser(),
      ]);

      if (!active) return;
      setReviews((reviewRows as Review[]) ?? []);
      setSummary((summaryRow as RatingSummary) ?? null);

      const user = userData.user;
      if (user) {
        const [{ data: purchased }, { data: mine }] = await Promise.all([
          supabase.from("order_items").select("id, orders!inner(customer_id)").eq("product_id", productId).eq("fulfillment_status", "delivered").eq("orders.customer_id", user.id),
          supabase.from("reviews").select("order_item_id").eq("product_id", productId).eq("reviewer_id", user.id),
        ]);

        if (!active) return;
        const reviewed = new Set((mine ?? []).map((row) => (row as { order_item_id: number | null }).order_item_id));
        const available = (purchased ?? []).find((row) => {
          const id = Number((row as { id: number }).id);
          return Number.isInteger(id) && !reviewed.has(id);
        });
        setEligibleItemId(available ? Number((available as { id: number }).id) : null);
      }
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, [productId]);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligibleItemId) return;

    setSubmitting(true);
    setMessage("");
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setSubmitting(false);
      setMessage("Please sign in again to review.");
      return;
    }

    const { error } = await supabase.from("reviews").insert({
      product_id: productId,
      order_item_id: eligibleItemId,
      reviewer_id: user.id,
      rating,
      comment: comment.trim() || null,
    });

    if (error) {
      setSubmitting(false);
      setMessage("We could not post your review. Please try again.");
      return;
    }

    const [{ data: reviewRows }, { data: summaryRow }] = await Promise.all([
      supabase.from("reviews").select("id, rating, comment, created_at").eq("product_id", productId).order("created_at", { ascending: false }),
      supabase.from("product_ratings").select("review_count, average_rating").eq("product_id", productId).maybeSingle(),
    ]);

    setReviews((reviewRows as Review[]) ?? []);
    setSummary((summaryRow as RatingSummary) ?? null);
    setEligibleItemId(null);
    setComment("");
    setRating(5);
    setSubmitting(false);
    setMessage("Thanks! Your review has been posted.");
  }

  const average = summary?.average_rating ? Number(summary.average_rating) : 0;
  const reviewCount = summary?.review_count ?? 0;

  return (
    <div className="mt-8 rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Customer Reviews</h2>
        {reviewCount > 0 ? <div className="flex items-center gap-2"><StarRow value={average} /><span className="text-sm font-semibold">{average.toFixed(1)}</span><span className="text-sm text-gray-500">({reviewCount} {reviewCount === 1 ? "review" : "reviews"})</span></div> : <span className="text-sm text-gray-500">No reviews yet</span>}
      </div>

      {loading && <p className="mt-4 text-gray-500">Loading reviews...</p>}

      {!loading && eligibleItemId && (
        <form onSubmit={submitReview} className="mt-6 rounded-2xl bg-green-50 p-5">
          <p className="font-semibold text-green-900">You bought this — leave a review</p>
          <div className="mt-3 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} className={`text-2xl ${n <= rating ? "text-amber-500" : "text-gray-300"}`}>★</button>)}
          </div>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={1000} placeholder="Share your experience (optional)" className="mt-3 w-full rounded-xl border border-gray-300 p-3 text-sm" />
          <button type="submit" disabled={submitting} className="mt-3 rounded-xl bg-green-700 px-5 py-2.5 font-semibold text-white disabled:opacity-60">{submitting ? "Posting..." : "Post review"}</button>
        </form>
      )}

      {message && <div role="status" className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">{message}</div>}

      {!loading && reviews.length > 0 && (
        <ul className="mt-6 divide-y">
          {reviews.map((review) => <li key={review.id} className="py-4"><div className="flex items-center gap-3"><StarRow value={review.rating} /><span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span></div><p className="mt-1 text-xs font-semibold text-gray-500">Verified buyer</p>{review.comment && <p className="mt-1 text-sm text-gray-700">{review.comment}</p>}</li>)}
        </ul>
      )}

      {!loading && reviews.length === 0 && !eligibleItemId && <p className="mt-4 text-sm text-gray-500">Be the first to review this product after receiving an order.</p>}
    </div>
  );
}
