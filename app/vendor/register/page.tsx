"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { NIGERIAN_STATES } from "@/lib/nigeria";

const REF_STORAGE_KEY = "fidwel_vendor_ref";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readRefId(): string {
  const fromUrl = new URLSearchParams(window.location.search).get("ref");

  if (fromUrl && UUID_PATTERN.test(fromUrl)) {
    return fromUrl;
  }

  const stored = window.localStorage.getItem(REF_STORAGE_KEY) ?? "";
  return UUID_PATTERN.test(stored) ? stored : "";
}

export default function VendorRegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    business_name: "",
    phone: "",
    description: "",
    state: "",
    lga: "",
    town: "",
    address: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("ref");

    if (fromUrl && UUID_PATTERN.test(fromUrl)) {
      window.localStorage.setItem(REF_STORAGE_KEY, fromUrl);
    }
  }, []);

  function updateField(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.push("/login?next=" + encodeURIComponent("/vendor/register"));
      return;
    }

    setLoading(true);

    const payload: Record<string, unknown> = {
      user_id: user.id,
      business_name: form.business_name.trim(),
      phone: form.phone.trim(),
      description: form.description.trim() || null,
      state: form.state.trim(),
      lga: form.lga.trim(),
      town: form.town.trim(),
      address: form.address.trim(),
      status: "pending",
      verified: false,
    };

    const referredBy = readRefId();

    if (referredBy) {
      payload.agent_id = referredBy;
    }

    let { error } = await supabase.from("vendor_profiles").insert(payload);

    if (error && payload.agent_id && error.code === "23503") {
      delete payload.agent_id;
      ({ error } = await supabase.from("vendor_profiles").insert(payload));
    }

    setLoading(false);

    if (error) {
      setMessage(
        error.code === "23505"
          ? "A vendor profile already exists for this account."
          : "Registration failed. Please check your details and try again."
      );
      console.error("Vendor registration error:", error.message, error.code, error.details);
      return;
    }

    window.localStorage.removeItem(REF_STORAGE_KEY);

    setMessage(
      "Registration submitted! Your vendor profile is awaiting verification."
    );
  }

  const inputClass =
    "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-green-600";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-2xl font-bold text-green-700"
        >
          FIDWEL
        </Link>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Register as a Vendor
          </h1>

          <p className="mt-2 text-gray-600">
            Join FIDWEL to connect your agricultural business
            with customers in your area.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block font-medium">
                Business name *
              </label>
              <input
                name="business_name"
                value={form.business_name}
                onChange={updateField}
                className={inputClass}
                placeholder="e.g. Green Valley Farms"
                required
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">
                Business phone number *
              </label>
              <input
                name="phone"
                value={form.phone}
                onChange={updateField}
                className={inputClass}
                placeholder="e.g. 08012345678"
                type="tel"
                required
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">
                Business description
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                className={inputClass}
                placeholder="What agricultural products do you sell?"
                rows={3}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block font-medium">
                  State *
                </label>
                <select
                  name="state"
                  value={form.state}
                  onChange={updateField}
                  className={inputClass}
                  required
                >
                  <option value="" disabled>
                    Select a state
                  </option>
                  {NIGERIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  LGA *
                </label>
                <input
                  name="lga"
                  value={form.lga}
                  onChange={updateField}
                  className={inputClass}
                  placeholder="Local government area"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block font-medium">
                Town or community *
              </label>
              <input
                name="town"
                value={form.town}
                onChange={updateField}
                className={inputClass}
                placeholder="Town or community"
                required
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">
                Business address *
              </label>
              <textarea
                name="address"
                value={form.address}
                onChange={updateField}
                className={inputClass}
                placeholder="Enter your business location"
                rows={2}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
            >
              {loading
                ? "Submitting..."
                : "Submit Vendor Registration"}
            </button>

            {message && (
              <p
                role="status"
                className="rounded-xl bg-green-50 p-4 text-sm text-green-800"
              >
                {message}
              </p>
            )}
          </form>

          <p className="mt-6 text-sm text-gray-500">
            New vendor accounts remain pending until they are
            verified. You must sign in before registering.
          </p>
        </div>
      </div>
    </main>
  );
}