"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export default function CartPage() {
  const { items, count, subtotal, updateQuantity, removeItem, clear } = useCart();

  const deliveryFee = subtotal > 0 ? (subtotal >= 25000 ? 0 : 1500) : 0;
  const orderTotal = subtotal + deliveryFee;

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <Link href="/products" className="text-sm font-medium hover:text-green-700">
            ← Continue shopping
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold">
          Your Cart
          {count > 0 && (
            <span className="ml-2 text-lg font-normal text-gray-500">
              ({count} item{count === 1 ? "" : "s"})
            </span>
          )}
        </h1>

        {items.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">🌾</div>
            <h2 className="mt-4 text-xl font-bold">Your cart is empty</h2>
            <p className="mt-2 text-gray-600">
              Explore fresh agricultural produce from local farmers and vendors.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-block rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm"
                >
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="h-20 w-20 shrink-0 rounded-xl object-cover"
                  />

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.id}`}
                      className="font-bold hover:text-green-700"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-sm font-semibold text-green-700">
                      ₦{Number(item.price).toLocaleString("en-NG")}
                      <span className="ml-1 font-normal text-gray-500">
                        / {item.unit}
                      </span>
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="h-7 w-7 rounded-md border font-bold text-gray-700 hover:bg-gray-100"
                        aria-label={`Decrease ${item.name}`}
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-bold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="h-7 w-7 rounded-md border font-bold text-gray-700 hover:bg-gray-100"
                        aria-label={`Increase ${item.name}`}
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="ml-2 text-xs text-gray-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <span className="shrink-0 font-bold">
                    ₦{(item.price * item.quantity).toLocaleString("en-NG")}
                  </span>
                </div>
              ))}

              <button
                onClick={clear}
                className="text-sm text-gray-400 hover:text-red-500"
              >
                Clear cart
              </button>
            </div>

            <aside className="h-fit rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">Order Summary</h2>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold">
                    ₦{subtotal.toLocaleString("en-NG")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery</span>
                  <span className="font-semibold">
                    {deliveryFee === 0 ? "Free" : `₦${deliveryFee.toLocaleString("en-NG")}`}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>Total</span>
                  <span className="text-green-700">
                    ₦{orderTotal.toLocaleString("en-NG")}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Free delivery on orders of ₦25,000 and above.
              </p>

              <Link
                href="/checkout"
                className="mt-6 block w-full rounded-xl bg-green-700 px-4 py-3 text-center font-semibold text-white hover:bg-green-800"
              >
                Proceed to Checkout
              </Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
