"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

type Product = {
  id: number;
  farm: string;
  rating: number;
  reviews: number;
  price: string;
  stock: string;
  verified: boolean;
  image: string;
  lat: string;
};

const products: Product[] = [
  { id: 1, farm: "FreshCatch Farms", rating: 4.8, reviews: 1134, price: "₦5,900/kg", stock: "2.1 ton", verified: true, image: "https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=200", lat: "Nearby" },
  { id: 2, farm: "Mama T's Agro", rating: 4.6, reviews: 892, price: "₦4,800/kg", stock: "2.5 ton", verified: true, image: "https://images.unsplash.com/photo-1543528173-d4dccdbf2e8c?w=200", lat: "Nearby" },
  { id: 3, farm: "Ocean Fresh", rating: 4.7, reviews: 1102, price: "₦5,200/kg", stock: "2.1 ton", verified: true, image: "https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?w=200", lat: "Nearby" },
  { id: 4, farm: "Fresh Plantain Bunch", rating: 4.9, reviews: 210, price: "₦2,500/kg", stock: "50 bunches", verified: true, image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=200", lat: "Nearby" },
  { id: 5, farm: "Yam Barn", rating: 4.7, reviews: 45, price: "₦1,800/kg", stock: "30 tubers", verified: true, image: "https://images.unsplash.com/photo-1596097156937-968d8e95c8e6?w=200", lat: "Nearby" },
];

const FILTERS = ["Price •", "Rating •", "Verified"];

function parsePrice(price: string): { amount: number; unit: string } {
  const amount = Number(price.replace(/[^0-9.]/g, ""));
  const unitMatch = price.match(/\/\s*([a-zA-Z]+)/);

  return {
    amount: Number.isFinite(amount) ? amount : 0,
    unit: unitMatch ? unitMatch[1] : "unit",
  };
}

export default function ProductsPage() {
  const { addItem, count } = useCart();

  function handleAddToCart(
    event: React.MouseEvent<HTMLButtonElement>,
    product: Product
  ) {
    event.preventDefault();
    event.stopPropagation();

    const { amount, unit } = parsePrice(product.price);

    addItem({
      id: product.id,
      name: product.farm,
      price: amount,
      unit,
      image_url: product.image,
    });
  }

  return (
    <main className="min-h-screen w-full bg-gray-50 font-sans">
      <div className="mx-auto w-full max-w-[480px] pb-24">
        {/* LOCATION */}
        <div className="flex items-center gap-1.5 px-3 pt-4 text-xs text-gray-500">
          <svg className="h-3.5 w-3.5 fill-current text-gray-400" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
          <span>Lagos, Nigeria</span>
        </div>

        {/* FILTER PILLS */}
        <div className="flex items-center gap-2 overflow-x-auto px-3 py-3">
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#16A34A] px-3 py-1 text-xs font-semibold text-white"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Nearby
          </button>

          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className="shrink-0 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-600"
            >
              {filter}
            </button>
          ))}
        </div>

        {/* PRODUCT LIST */}
        <div className="flex flex-col gap-3 px-3">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="flex gap-3 rounded-xl border border-gray-200 bg-white p-2 transition hover:shadow-sm"
            >
              <img
                src={product.image}
                alt={product.farm}
                className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
              />

              <div className="flex flex-1 flex-col gap-1">
                <h3 className="text-sm font-bold text-gray-900">{product.farm}</h3>

                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="font-semibold text-amber-500">⭐ {product.rating}</span>
                  <span>({product.reviews})</span>
                  <span className="text-gray-300">•</span>
                  {product.verified ? (
                    <span className="inline-flex items-center gap-0.5">
                      <svg className="h-3 w-3 text-[#16A34A]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Verified
                    </span>
                  ) : (
                    <span>Unverified</span>
                  )}
                </div>

                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{product.price}</p>
                    <p className="text-xs text-gray-400">{product.stock}</p>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => handleAddToCart(event, product)}
                    className="rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* BOTTOM LABEL */}
        <p className="mt-6 text-center text-xs text-gray-400">
          1.3 Product Listing (Nearby Vendors)
        </p>
      </div>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex w-full max-w-[480px] items-center justify-around px-4 py-2.5 text-gray-400">
          <button type="button" className="flex flex-col items-center gap-1">
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            <span className="text-[10px]">Home</span>
          </button>

          <button type="button" className="flex flex-col items-center gap-1">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span className="text-[10px]">Search</span>
          </button>

          <button type="button" className="relative flex flex-col items-center gap-1">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {count > 0 && (
              <span className="absolute -top-1 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#16A34A] text-[9px] font-bold text-white">
                {count}
              </span>
            )}
            <span className="text-[10px]">Cart</span>
          </button>

          <button type="button" className="flex flex-col items-center gap-1">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-[10px]">Orders</span>
          </button>

          <button type="button" className="flex flex-col items-center gap-1">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="text-[10px]">Profile</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
