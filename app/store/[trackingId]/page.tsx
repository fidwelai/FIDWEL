"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { rememberSalesTrackingId } from "@/lib/sales-tracking";

type StoreVendor = {
  id: string;
  trackingId: string;
  businessName: string;
  description: string | null;
  state: string | null;
  lga: string | null;
  town: string | null;
  verified: boolean;
  since: string;
};

type StoreProduct = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  quantity_available: number;
  image_url: string | null;
};

type StoreResponse = {
  vendor?: StoreVendor;
  products?: StoreProduct[];
  error?: string;
};

function VendorStoreContent() {
  const params = useParams<{ trackingId: string }>();
  const trackingId = params?.trackingId;
  const router = useRouter();
  const { addItem, count } = useCart();
  const [vendor, setVendor] = useState<StoreVendor | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!trackingId) return;
    let active = true;

    async function loadStore() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/public/stores/${encodeURIComponent(trackingId)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as StoreResponse;
        if (!response.ok || !payload.vendor) {
          throw new Error(payload.error ?? "This vendor store is unavailable.");
        }
        if (!active) return;

        try {
          rememberSalesTrackingId(payload.vendor.trackingId);
        } catch (caught) {
          console.error("Could not save sales tracking attribution:", caught);
          setMessage(
            "This browser could not save the vendor referral. You can still shop, but this visit may not be credited to the vendor."
          );
        }

        setVendor(payload.vendor);
        setProducts(payload.products ?? []);
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "We couldn't load this vendor store."
          );
        }

      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStore();
    return () => {
      active = false;
    };
  }, [trackingId]);

  function addProduct(product: StoreProduct) {
    addItem(
      {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        unit: product.unit,
        image_url: product.image_url || "/images/plantain.jpg",
      },
      1
    );
    setMessage(`${product.name} added to your cart.`);
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-12 text-gray-900">
      <nav className="border-b border-gray-200 bg-white px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/products"
              className="hidden text-sm font-medium text-gray-600 hover:text-green-700 sm:inline"
            >
              Browse marketplace
            </Link>
            <Link
              href="/cart"
              className="min-h-11 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800"
            >
              Cart{count > 0 ? ` (${count})` : ""}
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        {loading && <p role="status" className="text-gray-600">Loading vendor store...</p>}

        {!loading && error && (
          <div role="alert" className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold">Vendor store unavailable</h1>
            <p className="mt-3 text-gray-600">{error}</p>
            <Link
              href="/products"
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
            >
              Browse the marketplace
            </Link>
          </div>
        )}

        {!loading && !error && vendor && (
          <>
            <header className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">
                FIDWEL verified vendor
              </p>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
                <div>
                  <h1 className="text-3xl font-bold sm:text-4xl">{vendor.businessName}</h1>
                  <p className="mt-3 text-sm text-gray-600">
                    {[vendor.town, vendor.lga, vendor.state].filter(Boolean).join(", ") ||
                      "Location not provided"}
                  </p>
                  {vendor.description && (
                    <p className="mt-4 max-w-2xl leading-7 text-gray-700">
                      {vendor.description}
                    </p>
                  )}
                  <p className="mt-4 text-sm font-semibold text-green-800">
                    Verified and active on FIDWEL
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  On FIDWEL since{" "}
                  {new Date(vendor.since).toLocaleDateString("en-NG", {
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </header>

            {message && (
              <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {message}
              </p>
            )}

            {products.length === 0 ? (
              <div className="mt-8 rounded-2xl border bg-white p-8 text-center">
                <h2 className="text-xl font-bold">No products available right now</h2>
                <p className="mt-2 text-gray-600">Check back later or browse the FIDWEL marketplace.</p>
                <Link href="/products" className="mt-5 inline-flex min-h-11 items-center font-semibold text-green-700 hover:underline">
                  Browse all products
                </Link>
              </div>
            ) : (
              <section className="mt-9">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">Products from {vendor.businessName}</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {products.length} available listing{products.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Link href="/products" className="min-h-11 inline-flex items-center text-sm font-semibold text-green-700 hover:underline">
                    Explore all FIDWEL products
                  </Link>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <article key={product.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                      <Link
                        href={`/products/${product.id}?ref=${encodeURIComponent(vendor.trackingId)}`}
                        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-700"
                      >
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-52 w-full object-cover" />
                        ) : (
                          <div className="flex h-52 items-center justify-center bg-green-50 text-sm font-medium text-green-800">
                            Product image unavailable
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="text-lg font-bold">{product.name}</h3>
                          <p className="mt-2 text-xl font-bold text-green-700">
                            ₦{Number(product.price).toLocaleString("en-NG")} / {product.unit}
                          </p>
                          <p className="mt-2 text-sm text-gray-600">
                            {product.quantity_available} {product.unit} available
                          </p>
                        </div>
                      </Link>
                      <div className="px-4 pb-4">
                        <button
                          type="button"
                          onClick={() => addProduct(product)}
                          className="min-h-11 w-full rounded-xl bg-green-700 px-4 py-2.5 font-semibold text-white transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
                        >
                          Add to cart
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-10 rounded-2xl bg-green-950 p-6 text-white sm:p-8">
              <h2 className="text-xl font-bold">Shop securely with FIDWEL</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-green-100">
                Add products to your cart and complete checkout in the FIDWEL app. Your order and payment stay on the FIDWEL platform.
              </p>
              <button
                type="button"
                onClick={() => router.push("/cart")}
                className="mt-5 min-h-11 rounded-xl bg-white px-5 py-3 font-semibold text-green-900 hover:bg-green-50"
              >
                View cart and checkout
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default function VendorStorePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 px-5 py-12 text-gray-600">
          <p role="status">Loading vendor store...</p>
        </main>
      }
    >
      <VendorStoreContent />
    </Suspense>
  );
}
