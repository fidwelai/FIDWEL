"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type VendorProfile = {
  business_name: string;
  description: string | null;
  phone: string | null;
  state: string | null;
  lga: string | null;
  town: string | null;
  address: string | null;
  status: string;
  verified: boolean;
};

const initialForm: VendorProfile = {
  business_name: "",
  description: "",
  phone: "",
  state: "",
  lga: "",
  town: "",
  address: "",
  status: "pending",
  verified: false,
};

export default function VendorProfilePage() {
  const router = useRouter();

  const [form, setForm] = useState<VendorProfile>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login?next=/vendor/profile");
        return;
      }

      const { data, error: queryError } = await supabase
        .from("vendor_profiles")
        .select(
          "business_name, description, phone, state, lga, town, address, status, verified"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (queryError) {
        setError(queryError.message);
      } else if (data) {
        setForm({
          ...initialForm,
          ...data,
        } as VendorProfile);
      } else {
        setError(
          "No vendor profile was found. Please register your business first."
        );
      }

      setLoading(false);
    }

    void loadProfile();
  }, [router]);

  function updateField(
    field: keyof VendorProfile,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setSaving(false);
      router.replace("/login?next=/vendor/profile");
      return;
    }

    const { data, error: updateError } = await supabase
      .from("vendor_profiles")
      .update({
        business_name: form.business_name.trim(),
        description: form.description?.trim() || null,
        phone: form.phone?.trim() || null,
        state: form.state?.trim() || null,
        lga: form.lga?.trim() || null,
        town: form.town?.trim() || null,
        address: form.address?.trim() || null,
      })
      .eq("user_id", user.id)
      .select("user_id")
      .maybeSingle();

    if (updateError) {
      setError(updateError.message);
    } else if (!data) {
      setError(
        "Your profile was not updated. Check that your vendor profile exists and your database permissions allow this update."
      );
    } else {
      setMessage("Your business profile has been updated successfully.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 text-gray-700">
        Loading your vendor profile...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/vendor-dashboard"
          className="text-sm font-medium text-green-700 hover:underline"
        >
          ← Back to Vendor Dashboard
        </Link>

        <div className="mb-6 mt-4">
          <h1 className="text-3xl font-bold">Vendor Profile</h1>
          <p className="mt-2 text-gray-600">
            Manage your business details and registered selling location.
          </p>
        </div>

        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Verification status</h2>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                form.verified
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {form.verified ? "Verified seller" : "Not yet verified"}
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
              Account: {form.status}
            </span>
          </div>

          <p className="mt-3 text-sm text-gray-600">
            Verification and account status are managed by FIDWEL. Editing
            this form will not change either status.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
          >
            {message}
          </div>
        )}

        {!error || form.business_name ? (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-xl bg-white p-6 shadow-sm"
          >
            <div>
              <label
                htmlFor="business_name"
                className="mb-2 block text-sm font-medium"
              >
                Business name *
              </label>
              <input
                id="business_name"
                required
                value={form.business_name}
                onChange={(e) =>
                  updateField("business_name", e.target.value)
                }
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-700"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-medium"
              >
                Business phone number
              </label>
              <input
                id="phone"
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => updateField("phone", e.target.value)}
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-700"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium"
              >
                Business description
              </label>
              <textarea
                id="description"
                rows={3}
                value={form.description ?? ""}
                onChange={(e) =>
                  updateField("description", e.target.value)
                }
                placeholder="Tell customers about your farm or business."
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-700"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="state"
                  className="mb-2 block text-sm font-medium"
                >
                  State
                </label>
                <input
                  id="state"
                  value={form.state ?? ""}
                  onChange={(e) => updateField("state", e.target.value)}
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-700"
                />
              </div>

              <div>
                <label
                  htmlFor="lga"
                  className="mb-2 block text-sm font-medium"
                >
                  Local Government Area (LGA)
                </label>
                <input
                  id="lga"
                  value={form.lga ?? ""}
                  onChange={(e) => updateField("lga", e.target.value)}
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-700"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="town"
                className="mb-2 block text-sm font-medium"
              >
                Town or community
              </label>
              <input
                id="town"
                value={form.town ?? ""}
                onChange={(e) => updateField("town", e.target.value)}
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-700"
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="mb-2 block text-sm font-medium"
              >
                Business address
              </label>
              <textarea
                id="address"
                rows={2}
                value={form.address ?? ""}
                onChange={(e) => updateField("address", e.target.value)}
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-700"
              />
            </div>

            <button
              type="submit"
              disabled={saving || !form.business_name.trim()}
              className="w-full rounded-lg bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving changes..." : "Save Business Profile"}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}