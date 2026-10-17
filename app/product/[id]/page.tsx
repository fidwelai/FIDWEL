"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";

type Product = {
  id: number;
  name: string;
  vendor: string;
  price: number;
  oldPrice: number;
  rating: number;
  reviews: number;
  image: string;
  description: string;
};

const products: Product[] = [
  { id: 1, name: "Fresh Plantain Bunch", vendor: "Mama Gold Farm", price: 2500, oldPrice: 3000, rating: 4.8, reviews: 120, image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400", description: "Freshly harvested plantain bunch from our farm in Ogun State. Naturally ripened, no chemicals. Perfect for dodo, porridge and more. Delivery within 24hrs in Lagos." },
  { id: 2, name: "Catfish (Live)", vendor: "Fish Hub", price: 3500, oldPrice: 4000, rating: 4.9, reviews: 89, image: "https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?w=400", description: "Live fresh catfish, 1kg per fish. Grown in clean water, no antibiotics." },
  { id: 3, name: "White Yam Tubers", vendor: "Yam Barn", price: 1800, oldPrice: 2200, rating: 4.7, reviews: 45, image: "https://images.unsplash.com/photo-1596097156937-968d8e95c8e6?w=400", description: "Fresh white yam tubers, sweet and perfect for pounding." },
  { id: 4, name: "Fresh Cassava", vendor: "Root Farms", price: 1200, oldPrice: 1500, rating: 4.6, reviews: 32, image: "https://images.unsplash.com/photo-1543528173-d4dccdbf2e8c?w=400", description: "Fresh cassava tubers harvested today." },
  { id: 5, name: "Ugwu Leaves", vendor: "Green Farms", price: 500, oldPrice: 700, rating: 4.8, reviews: 110, image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400", description: "Fresh ugwu leaves, washed and ready." },
  { id: 6, name: "Palm Oil 5L", vendor: "Oil Mill", price: 8000, oldPrice: 9500, rating: 4.9, reviews: 210, image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400", description: "Pure palm oil 5 litres, unadulterated." },
];

const DEMO_CART_ID_OFFSET = 1_000_000;

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
          Loading product…
        </div>
      }
    >
      <ProductDetailContent />
    </Suspense>
  );
}

function ProductDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addItem } = useCart();

  const product =
    products.find((p) => p.id === Number(params?.id)) || products[0];

  const [quantity, setQuantity] = useState(1);
  const [favorite, setFavorite] = useState(false);
  const [added, setAdded] = useState(false);

  const discount = Math.floor(
    ((product.oldPrice - product.price) / product.oldPrice) * 100
  );

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: product.name, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  function buildCartItem() {
    return {
      id: product.id + DEMO_CART_ID_OFFSET,
      name: product.name,
      price: product.price,
      unit: "unit",
      image_url: product.image,
    };
  }

  function handleAddToCart() {
    addItem(buildCartItem(), quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  }

  function handleBuyNow() {
    addItem(buildCartItem(), quantity);
    router.push("/cart");
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 font-sans">
      <div className="mx-auto w-full max-w-2xl pb-32">
        {/* TOP BAR */}
        <div className="flex items-center justify-between p-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 shadow-xs transition hover:bg-gray-100"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 shadow-xs transition hover:bg-gray-100"
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => setFavorite((prev) => !prev)}
              aria-pressed={favorite}
              aria-label="Add to favourites"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg shadow-xs transition hover:bg-gray-100 ${
                favorite ? "text-red-500" : "text-gray-800"
              }`}
            >
              ♥
            </button>
          </div>
        </div>

        {/* IMAGE */}
        <img
          src={product.image}
          alt={product.name}
          className="h-80 w-full object-cover"
        />

        {/* INFO CARD */}
        <div className="relative -mt-6 space-y-3 rounded-t-2xl bg-white p-4 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>

          <p className="text-sm text-gray-500">
            Sold by {product.vendor}{" "}
            <span className="font-semibold text-blue-600">✓ Verified</span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-gray-900">
              ₦{product.price.toLocaleString("en-NG")}
            </span>
            <span className="text-base text-gray-400 line-through">
              ₦{product.oldPrice.toLocaleString("en-NG")}
            </span>
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
              {discount}% OFF
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
            <span className="font-semibold text-amber-500">
              ⭐ {product.rating}
            </span>
            <span>({product.reviews} reviews)</span>
            <span className="text-gray-300">•</span>
            <span className="font-semibold text-gray-900">In Stock</span>
          </div>

          <div className="space-y-1.5 pt-1">
            <h3 className="font-bold text-gray-900">Description</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              {product.description}
            </p>
          </div>

          {/* QUANTITY */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-semibold text-gray-700">
              Quantity
            </span>
            <div className="flex items-center overflow-hidden rounded-lg border border-gray-300">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="h-10 w-11 text-lg font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-40"
                disabled={quantity <= 1}
              >
                −
              </button>
              <span className="w-12 text-center text-base font-bold text-gray-900">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Increase quantity"
                className="h-10 w-11 text-lg font-bold text-gray-700 transition hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM FIXED ACTIONS */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4">
        <div className="mx-auto flex w-full max-w-2xl gap-3">
          <button
            type="button"
            onClick={handleAddToCart}
            className="h-12 flex-1 rounded-xl bg-black text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[0.98]"
          >
            Add to Cart
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            className="h-12 flex-1 rounded-xl border border-black text-sm font-semibold text-black transition hover:bg-gray-100 active:scale-[0.98]"
          >
            Buy Now
          </button>
        </div>
      </div>

      {/* ADDED TO CART TOAST */}
      {added && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            ✓ Added {quantity} to cart
          </div>
        </div>
      )}
    </div>
  );
}
