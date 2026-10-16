"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

function normalizeUnit(name: string, unit: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("plantain") || lower.includes("cassava")) {
    return "kg";
  }
  return unit;
}

function ProductDetailContent() {
  const params = useParams<{ id: string }>();
  const productId = params?.id;

  const { addItem, count } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!productId) {
      return;
    }

    async function loadProduct() {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
        .from("products")
        .select(
          "id, name, description, price, unit, quantity_available, image_url, category_id, vendor_id"
        )
        .eq("id", Number(productId))
        .eq("is_available", true)
        .eq("approval_status", "approved")
        .gt("quantity_available", 0)
        .maybeSingle();

      if (queryError || !data) {
        setError("This product is no longer available.");
        setProduct(null);
        setLoading(false);
        return;
      }

      setProduct({
        ...(data as Product),
        unit: normalizeUnit((data as Product).name, (data as Product).unit),
      });
      setLoading(false);

      if ((data as Product).category_id) {
        const { data: category } = await supabase
          .from("categories")
          .select("name")
          .eq("id", (data as Product).category_id)
          .maybeSingle();

        setCategoryName(category?.name ?? null);
      }
    }

    loadProduct();
  }, [productId]);

  function handleAddToCart() {
    if (!product) {
      return;
    }

    addItem(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        image_url: product.image_url || "/images/plantain.jpg",
      },
      quantity
    );
    setAdded(true);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/products" className="text-sm font-medium hover:text-green-700">
              ← Back to Products
            </Link>
            <Link
              href="/cart"
              className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
            >
              Cart{count > 0 ? ` (${count})` : ""}
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-10">
        {loading && <p className="text-gray-600">Loading product...</p>}

        {!loading && error && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">🌾</div>
            <h2 className="mt-4 text-xl font-bold">{error}</h2>
            <Link
              href="/products"
              className="mt-6 inline-block rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
            >
              Browse other products
            </Link>
          </div>
        )}

        {!loading && !error && product && (
          <div className="overflow-hidden rounded-3xl border bg-white shadow-sm md:flex">
            <div className="md:w-1/2">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-72 w-full object-cover md:h-full"
                />
              ) : (
                <div className="flex h-72 items-center justify-center bg-green-50 text-7xl md:h-full">
                  🌱
                </div>
              )}
            </div>

            <div className="p-8 md:w-1/2">
              {categoryName && (
                <span className="inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  {categoryName}
                </span>
              )}

              <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
                {product.name}
              </h1>

              <p className="mt-3 text-3xl font-bold text-green-700">
                ₦{Number(product.price).toLocaleString("en-NG")}
                <span className="ml-1 text-base font-normal text-gray-500">
                  / {product.unit}
                </span>
              </p>

              <p className="mt-4 text-gray-600">
                {product.description || "Contact the vendor for details."}
              </p>

              <p className="mt-4 text-sm text-gray-500">
                Available: {product.quantity_available} {product.unit}
              </p>

              <div className="mt-6 flex items-center gap-4">
                <div className="flex items-center rounded-xl border">
                  <button
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="px-4 py-3 text-lg font-bold text-gray-600 hover:text-green-700"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-10 text-center font-bold">{quantity}</span>
                  <button
                    onClick={() =>
                      setQuantity((value) =>
                        Math.min(Math.floor(product.quantity_available), value + 1)
                      )
                    }
                    className="px-4 py-3 text-lg font-bold text-gray-600 hover:text-green-700"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <span className="font-bold text-gray-800">
                  ₦{(product.price * quantity).toLocaleString("en-NG")}
                </span>
              </div>

              <button
                onClick={handleAddToCart}
                className="mt-6 w-full rounded-xl bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800"
              >
                Add to Cart
              </button>

              {added && (
                <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">
                  Added to your cart.{" "}
                  <Link href="/cart" className="font-bold underline">
                    View cart
                  </Link>
                </div>
              )}

              <p className="mt-4 text-xs text-gray-500">
                You will be asked to sign in when you check out.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && product && <ProductReviews productId={product.id} />}
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
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rounded ? "text-amber-500" : "text-gray-300"}>
          ★
        </span>
      ))}
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
      const [{ data: reviewRows }, { data: summaryRow }, { data: userData }] =
        await Promise.all([
          supabase
            .from("reviews")
            .select("id, rating, comment, created_at")
            .eq("product_id", productId)
            .order("created_at", { ascending: false }),
          supabase
            .from("product_ratings")
            .select("review_count, average_rating")
            .eq("product_id", productId)
            .maybeSingle(),
          supabase.auth.getUser(),
        ]);

      if (!active) {
        return;
      }

      setReviews((reviewRows as Review[]) ?? []);
      setSummary((summaryRow as RatingSummary) ?? null);

      const user = userData.user;

      if (user) {
        const { data: purchased } = await supabase
          .from("order_items")
          .select("id, orders!inner(customer_id)")
          .eq("product_id", productId)
          .eq("fulfillment_status", "delivered")
          .eq("orders.customer_id", user.id);

        const { data: mine } = await supabase
          .from("reviews")
          .select("order_item_id")
          .eq("product_id", productId)
          .eq("reviewer_id", user.id);

        if (!active) {
          return;
        }

        const reviewed = new Set(
          (mine ?? []).map((row) => (row as { order_item_id: number | null }).order_item_id)
        );

        const available = (purchased ?? []).find((row) => {
          const id = Number((row as { id: number }).id);
          return Number.isInteger(id) && !reviewed.has(id);
        });

        setEligibleItemId(available ? Number((available as { id: number }).id) : null);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [productId]);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eligibleItemId) {
      return;
    }

    setSubmitting(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

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
      supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false }),
      supabase
        .from("product_ratings")
        .select("review_count, average_rating")
        .eq("product_id", productId)
        .maybeSingle(),
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
  const count = summary?.review_count ?? 0;

  return (
    <div className="mt-8 rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Customer Reviews</h2>
        {count > 0 ? (
          <div className="flex items-center gap-2">
            <StarRow value={average} />
            <span className="text-sm font-semibold text-gray-700">{average.toFixed(1)}</span>
            <span className="text-sm text-gray-500">
              ({count} {count === 1 ? "review" : "reviews"})
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-500">No reviews yet</span>
        )}
      </div>

      {loading && <p className="mt-4 text-gray-500">Loading reviews...</p>}

      {!loading && eligibleItemId && (
        <form onSubmit={submitReview} className="mt-6 rounded-2xl bg-green-50 p-5">
          <p className="font-semibold text-green-900">You bought this — leave a review</p>

          <div className="mt-3 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className={`text-2xl ${n <= rating ? "text-amber-500" : "text-gray-300"}`}
              >
                ★
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder="Share what you thought about this product (optional)"
            className="mt-3 w-full rounded-xl border border-gray-300 p-3 text-sm"
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-3 rounded-xl bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
          >
            {submitting ? "Posting..." : "Post review"}
          </button>
        </form>
      )}

      {message && (
        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">{message}</div>
      )}

      {!loading && reviews.length > 0 && (
        <ul className="mt-6 divide-y">
          {reviews.map((review) => (
            <li key={review.id} className="py-4">
              <div className="flex items-center gap-3">
                <StarRow value={review.rating} />
                <span className="text-xs text-gray-400">
                  {new Date(review.created_at).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-gray-500">Verified buyer</p>
              {review.comment && <p className="mt-1 text-sm text-gray-700">{review.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {!loading && reviews.length === 0 && !eligibleItemId && (
        <p className="mt-4 text-sm text-gray-500">
          Be the first to review this product after receiving an order.
        </p>
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50">
          <nav className="border-b bg-white px-6 py-4">
            <div className="mx-auto flex max-w-7xl items-center justify-between">
              <span className="text-2xl font-bold text-green-700">FIDWEL</span>
            </div>
          </nav>
          <section className="mx-auto max-w-5xl px-6 py-10">
            <p className="text-gray-600">Loading product...</p>
          </section>
        </main>
      }
    >
      <ProductDetailContent />
    </Suspense>
  );
}
