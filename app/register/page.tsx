"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { looksLikeImage, prepareAvatarImage } from "@/lib/image-upload";
import { resolveAccountDestination } from "@/lib/account";

export default function RegisterPage() {
  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A signed-in user should never see the create-account form again.
  useEffect(() => {
    let active = true;

    async function redirectIfSignedIn() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;

        if (!user) {
          setChecking(false);
          return;
        }

        window.location.replace(await resolveAccountDestination(user));
      } catch {
        if (active) {
          setChecking(false);
        }
      }
    }

    void redirectIfSignedIn();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setTimeout(() => {
          void redirectIfSignedIn();
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!looksLikeImage(file)) {
      setMessage("Please choose an image file (JPG or PNG).");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setMessage("That image is too large. Please choose one under 25 MB.");
      return;
    }
    setMessage("");
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleRegister(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    if (password.length < 8) {
      setMessage("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Your passwords do not match.");
      return;
    }

    setLoading(true);

    // Upload avatar if provided (downscaled to keep it small and well-supported)
    let avatarUrl: string | null = null;
    if (avatarFile) {
      try {
        const prepared = await prepareAvatarImage(avatarFile);
        const path = `public/${Date.now()}-${Math.random().toString(36).slice(2)}.${prepared.extension}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, prepared.blob, {
            upsert: false,
            contentType: prepared.contentType,
          });
        if (uploadError) {
          setLoading(false);
          setMessage("Failed to upload profile picture. Please try again.");
          return;
        }
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      } catch {
        setLoading(false);
        setMessage(
          "We couldn't read that image. Please try a different photo."
        );
        return;
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_SITE_URL || window.location.origin,
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          account_type: "customer",
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        },
      },
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    // With email confirmation enabled, a session may not exist yet.
    if (!data.session) {
      setLoading(false);
      setSuccess(true);
      setMessage(
        "Account created! Check your email to confirm your address before signing in."
      );
      return;
    }

    // Every new account starts as a regular FIDWEL user. Role-specific
    // onboarding happens only after the user has created and confirmed an account.
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      window.location.replace(next);
      return;
    }

    window.location.replace("/");
  }

  const inputClass =
    "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600";

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <p className="text-sm text-gray-500">Checking your session…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <Link href="/" className="text-2xl font-bold text-green-700">
          FIDWEL
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-gray-900">
          Create your account
        </h1>

        <p className="mt-2 text-gray-600">
          Create your free FIDWEL user account first. Once you are signed in,
          you can shop, apply to become a vendor, or access an approved agent account.
        </p>

        <form onSubmit={handleRegister} className="mt-8 space-y-5">
          {/* Profile Picture Picker */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group"
              aria-label="Upload profile picture"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-gray-300 group-hover:border-green-500 transition flex items-center justify-center bg-gray-50">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-gray-400 group-hover:text-green-600 transition">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                    <span className="text-[10px] mt-1 font-medium">Add photo</span>
                  </div>
                )}
              </div>
              {avatarPreview && (
                <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-green-600 border-2 border-white flex items-center justify-center text-white text-xs shadow">
                  ✎
                </span>
              )}
            </button>
            <p className="text-xs text-gray-500">Optional · JPG or PNG · Auto-optimized</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="sr-only"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">Full name *</label>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={inputClass}
              placeholder="Enter your full name"
              autoComplete="name"
              required
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">Email address *</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">Phone number *</label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inputClass}
              placeholder="08012345678"
              autoComplete="tel"
              required
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">Password *</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Confirm password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={inputClass}
              placeholder="Enter your password again"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          {message && (
            <p
              role={success ? "status" : "alert"}
              className={`rounded-xl p-4 text-sm ${
                success
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {message}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-green-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}