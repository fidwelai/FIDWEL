"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
};

function EditProductContent() {
  const params = useParams<{ id: string }>();
  const productId = params?.id;
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [checking, setChecking] = useState(true);
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    category_id: "",
    description: "",
    price: "",
    unit: "kg",
    quantity_available: "",
    image_url: "",
  });

  useEffect(() => {
    async function initialize() {
      if (!productId) {
        setMessage("Product not found.");
        setChecking(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace(
          "/login?next=" +
            encodeURIComponent(`/vendor/products/${productId}/edit`)
        );
        return;
      }

      const { data: vendor, error: vendorError } = await supabase
        .from("vendor_profiles")
        .select("id, status, verified")
        .eq("user_id", user.id)
        .maybeSingle();

      if (vendorError) {
        setMessage("Unable to verify your vendor account. Please try again.");
        setChecking(false);
        return;
      }

      if (!vendor || vendor.status !== "active" || vendor.verified !== true) {
        setApproved(false);
        setChecking(false);
        return;
      }

      setApproved(true);

      const { data: categoryRows, error: categoryError } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");

      if (categoryError) {
        setMessage("Unable to load product categories.");
      } else {
        setCategories((categoryRows ?? []) as Category[]);
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .select(
          "name, description, price, unit, quantity_available, image_url, category_id"
        )
        .eq("id", productId)
        .eq("vendor_id", vendor.id)
        .maybeSingle();

      if (productError || !product) {
        setMessage("We could not find that product in your catalogue.");
        setChecking(false);
        return;
      }

      setForm({
        name: product.name ?? "",
        category_id: product.category_id ? String(product.category_id) : "",
        description: product.description ?? "",
        price: product.price !== null ? String(product.price) : "",
        unit: product.unit ?? "kg",
        quantity_available:
          product.quantity_available !== null
            ? String(product.quantity_available)
            : "",
        image_url: product.image_url ?? "",
      });

      setChecking(false);
    }

    initialize();
  }, [productId]);

  function updateField(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageError("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Only JPG, PNG or WebP images are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image must be smaller than 5 MB.");
      return;
    }

    setUploading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/uploads/product-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      });

      const payload: { url?: string; error?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Could not upload the image.");
      }

      setForm((previous) => ({ ...previous, image_url: payload.url as string }));
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Could not upload the image."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!approved || !productId) {
      setMessage("Only approved vendors can edit products.");
      return;
    }

    const price = Number(form.price);
    const quantity = Number(form.quantity_available);

    if (!Number.isFinite(price) || price <= 0) {
      setMessage("Enter a valid price greater than zero.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessage("Enter an available quantity greater than zero.");
      return;
    }

    if (!form.category_id) {
      setMessage("Please select a product category.");
      return;
    }

    if (form.image_url.trim()) {
      try {
        const url = new URL(form.image_url.trim());
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          setMessage("Please enter a valid image URL.");
          return;
        }
      } catch {
        setMessage("Please enter a valid image URL.");
        return;
      }
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      window.location.replace("/login");
      return;
    }

    const { data: vendor, error: vendorError } = await supabase
      .from("vendor_profiles")
      .select("id, status, verified")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      vendorError ||
      !vendor ||
      vendor.status !== "active" ||
      vendor.verified !== true
    ) {
      setSaving(false);
      setMessage(
        "Your vendor account could not be verified as active. Please check your vendor approval."
      );
      return;
    }

    const { data, error } = await supabase
      .from("products")
      .update({
        name: form.name.trim(),
        category_id: Number(form.category_id),
        description: form.description.trim() || null,
        price,
        unit: form.unit,
        quantity_available: quantity,
        image_url: form.image_url.trim() || null,
      })
      .eq("id", productId)
      .eq("vendor_id", vendor.id)
      .select("id")
      .maybeSingle();

    setSaving(false);

    if (error) {
      setMessage("Could not save the product: " + error.message);
      return;
    }

    if (!data) {
      setMessage("Could not save the product. Please try again.");
      return;
    }

    router.push("/vendor/products");
  }

  const inputClass =
    "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-600";

  if (checking) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        Checking your vendor account...
      </main>
    );
  }

  if (!approved) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <h1 className="mt-6 text-2xl font-bold">Vendor approval required</h1>
          <p className="mt-3 text-gray-600">
            Only verified, active vendors can edit products.
          </p>
          {message && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {message}
            </p>
          )}
          <Link
            href="/vendor-dashboard"
            className="mt-6 inline-block rounded-xl bg-green-700 px-5 py-3 font-semibold text-white"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-green-700">
            FIDWEL
          </Link>
          <Link
            href="/vendor/products"
            className="text-sm font-medium text-green-700"
          >
            ← My products
          </Link>
        </nav>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit product</h1>
          <p className="mt-2 text-gray-600">
            Update the details customers see for this listing.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block font-medium">Product name *</label>
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                className={inputClass}
                placeholder="e.g. Fresh plantain"
                required
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">Category *</label>
              <select
                name="category_id"
                value={form.category_id}
                onChange={updateField}
                className={inputClass}
                required
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block font-medium">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                className={inputClass}
                rows={4}
                placeholder="Describe the product, quality, origin, or packaging."
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block font-medium">Price (₦) *</label>
                <input
                  name="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={updateField}
                  className={inputClass}
                  placeholder="e.g. 2500"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Selling unit *</label>
                <select
                  name="unit"
                  value={form.unit}
                  onChange={updateField}
                  className={inputClass}
                  required
                >
                  <option value="kg">Kilogram (kg)</option>
                  <option value="gram">Gram</option>
                  <option value="litre">Litre</option>
                  <option value="bag">Bag</option>
                  <option value="basket">Basket</option>
                  <option value="crate">Crate</option>
                  <option value="carton">Carton</option>
                  <option value="bunch">Bunch</option>
                  <option value="piece">Piece</option>
                  <option value="tonne">Tonne</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block font-medium">
                Available quantity *
              </label>
              <input
                name="quantity_available"
                type="number"
                min="0.01"
                step="any"
                value={form.quantity_available}
                onChange={updateField}
                className={inputClass}
                placeholder="e.g. 50"
                required
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">
                Product image (optional)
              </label>
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  {form.image_url ? (
                    <img
                      src={form.image_url}
                      alt="Product preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      No image
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-xl border border-green-700 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60"
                  >
                    {uploading ? "Uploading..." : "Upload image"}
                  </button>
                  {form.image_url && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((previous) => ({ ...previous, image_url: "" }))
                      }
                      className="text-xs text-gray-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="sr-only"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                JPG, PNG or WebP · Max 5 MB.
              </p>
              {imageError && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {imageError}
                </p>
              )}
              <input
                name="image_url"
                type="url"
                value={form.image_url}
                onChange={updateField}
                className={`${inputClass} mt-3`}
                placeholder="or paste an image URL (https://...)"
              />
            </div>

            <button
              type="submit"
              disabled={saving || uploading}
              className="w-full rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
            >
              {saving ? "Saving changes..." : "Save changes"}
            </button>

            {message && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
              >
                {message}
              </p>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}

export default function EditProductPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50">
          <section className="mx-auto max-w-5xl px-6 py-10">
            <p className="text-gray-600">Loading product...</p>
          </section>
        </main>
      }
    >
      <EditProductContent />
    </Suspense>
  );
}
