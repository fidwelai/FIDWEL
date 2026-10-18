"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);

    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setMessage("We couldn't send the reset email. Check the address and try again.");
      return;
    }

    setSuccess(true);
    setMessage("If an account exists for this email, a password reset link will be sent. Check your inbox and spam folder.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <Link href="/" className="text-2xl font-extrabold text-green-700">FIDWEL</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-green-700">Account recovery</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Forgot your password?</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Enter the email address connected to your FIDWEL account and we'll send you a secure reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-gray-800">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-700 px-5 py-3 font-semibold text-white transition hover:bg-green-800 disabled:opacity-60"
          >
            {loading ? "Sending link..." : "Send reset link"}
          </button>
          {message && (
            <p role={success ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
              {message}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Remembered your password?{" "}
          <Link href="/login" className="font-semibold text-green-700 hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
